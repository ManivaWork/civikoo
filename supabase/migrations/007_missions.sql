-- 007: missions system
-- ============================================================================
-- Depends on: 001 (profiles), 002 (reports), 003 (report_confirmations), 005 (award_reward)

CREATE TYPE public.mission_type AS ENUM ('diaria', 'semanal');
CREATE TYPE public.mission_metric AS ENUM ('reportes', 'confirmacoes', 'resolucoes', 'reportes_categoria');

CREATE TABLE IF NOT EXISTS public.mission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  type public.mission_type NOT NULL,
  metric public.mission_metric NOT NULL,
  category text, -- for reportes_categoria
  target int NOT NULL,
  reward_xp int NOT NULL DEFAULT 0,
  reward_coins int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.mission_templates(id) ON DELETE CASCADE,
  period_start date NOT NULL, -- America/Sao_Paulo date
  progress int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, period_start)
);

CREATE INDEX IF NOT EXISTS user_missions_user_idx ON public.user_missions (user_id);
CREATE INDEX IF NOT EXISTS user_missions_period_idx ON public.user_missions (period_start);

-- RLS
ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select_active" ON public.mission_templates;
CREATE POLICY "templates_select_active" ON public.mission_templates
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "user_missions_select_own" ON public.user_missions;
CREATE POLICY "user_missions_select_own" ON public.user_missions
  FOR SELECT USING (auth.uid() = user_id);

-- RPC: get my missions (creates if needed for current period)
CREATE OR REPLACE FUNCTION public.get_my_missions()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  template_id uuid,
  period_start date,
  progress int,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz,
  template public.mission_templates,
  is_completed boolean,
  is_claimed boolean,
  can_claim boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := now() AT TIME ZONE 'America/Sao_Paulo'::text;
  v_week_start date := v_today - (EXTRACT(DOW FROM v_today)::int || ' days')::interval;
  v_period_start date;
  v_template public.mission_templates;
  v_mission public.user_missions;
  v_progress int;
BEGIN
  FOR v_template IN SELECT * FROM public.mission_templates WHERE active = true
  LOOP
    v_period_start := CASE v_template.type
      WHEN 'diaria' THEN v_today
      WHEN 'semanal' THEN v_week_start
    END;

    -- Get or create user mission
    INSERT INTO public.user_missions (user_id, template_id, period_start)
    VALUES (v_user_id, v_template.id, v_period_start)
    ON CONFLICT (user_id, template_id, period_start) DO NOTHING;

    SELECT * INTO v_mission FROM public.user_missions
    WHERE user_id = v_user_id AND template_id = v_template.id AND period_start = v_period_start;

    -- Calculate progress based on metric
    v_progress := CASE v_template.metric
      WHEN 'reportes' THEN (
        SELECT count(*) FROM public.reports
        WHERE user_id = v_user_id
          AND created_at >= v_period_start
          AND (v_template.type = 'diaria' AND created_at < v_today + interval '1 day' OR v_template.type = 'semanal')
          AND (v_template.category IS NULL OR category = v_template.category)
      )
      WHEN 'confirmacoes' THEN (
        SELECT count(*) FROM public.report_confirmations
        WHERE user_id = v_user_id
          AND type = 'continua'
          AND created_at >= v_period_start
          AND (v_template.type = 'diaria' AND created_at < v_today + interval '1 day' OR v_template.type = 'semanal')
      )
      WHEN 'resolucoes' THEN (
        SELECT count(*) FROM public.report_confirmations
        WHERE user_id = v_user_id
          AND type = 'resolvido'
          AND created_at >= v_period_start
          AND (v_template.type = 'diaria' AND created_at < v_today + interval '1 day' OR v_template.type = 'semanal')
      )
      WHEN 'reportes_categoria' THEN (
        SELECT count(*) FROM public.reports
        WHERE user_id = v_user_id
          AND category = v_template.category
          AND created_at >= v_period_start
          AND (v_template.type = 'diaria' AND created_at < v_today + interval '1 day' OR v_template.type = 'semanal')
      )
      ELSE 0
    END;

    -- Update progress
    UPDATE public.user_missions
    SET progress = v_progress,
        completed_at = CASE WHEN v_progress >= v_template.target AND completed_at IS NULL THEN now() ELSE completed_at END
    WHERE id = v_mission.id;

    SELECT * INTO v_mission FROM public.user_missions WHERE id = v_mission.id;

    RETURN QUERY SELECT
      v_mission.id, v_mission.user_id, v_mission.template_id, v_mission.period_start,
      v_mission.progress, v_mission.completed_at, v_mission.claimed_at, v_mission.created_at,
      v_template,
      (v_mission.progress >= v_template.target) as is_completed,
      (v_mission.claimed_at IS NOT NULL) as is_claimed,
      (v_mission.progress >= v_template.target AND v_mission.claimed_at IS NULL) as can_claim;
  END LOOP;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_missions TO authenticated;

-- RPC: claim mission reward
CREATE OR REPLACE FUNCTION public.claim_mission(p_user_mission_id uuid)
RETURNS TABLE (success boolean, message text, xp_earned int, coins_earned int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_mission public.user_missions;
  v_template public.mission_templates;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Não autenticado', 0, 0;
    RETURN;
  END IF;

  -- Trava a linha da missão (evita resgate duplo simultâneo)
  SELECT um.* INTO v_mission
  FROM public.user_missions um
  WHERE um.id = p_user_mission_id
    AND um.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Missão não encontrada', 0, 0;
    RETURN;
  END IF;

  SELECT mt.* INTO v_template
  FROM public.mission_templates mt
  WHERE mt.id = v_mission.template_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Template da missão não encontrado', 0, 0;
    RETURN;
  END IF;

  IF v_mission.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Já resgatada', 0, 0;
    RETURN;
  END IF;

  IF v_mission.progress < v_template.target THEN
    RETURN QUERY SELECT false, 'Missão não concluída', 0, 0;
    RETURN;
  END IF;

  UPDATE public.user_missions
  SET claimed_at = now()
  WHERE id = p_user_mission_id;

  PERFORM public.award_reward(
    v_user_id, 'mission_claim',
    v_template.reward_xp, v_template.reward_coins,
    'mission', p_user_mission_id
  );

  RETURN QUERY SELECT true, 'Resgatado com sucesso',
                      v_template.reward_xp, v_template.reward_coins;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mission(uuid) TO authenticated;

-- Seed default missions
INSERT INTO public.mission_templates (code, title, description, type, metric, target, reward_xp, reward_coins) VALUES
  ('daily_report_1', 'Reporte 1 problema', 'Crie 1 reporte hoje', 'diaria', 'reportes', 1, 50, 10),
  ('daily_report_3', 'Reporte 3 problemas', 'Crie 3 reportes hoje', 'diaria', 'reportes', 3, 150, 30),
  ('daily_confirm_2', 'Confirme 2 reportes', 'Confirme "continua" em 2 reportes', 'diaria', 'confirmacoes', 2, 100, 20),
  ('daily_resolve_1', 'Resolva 1 reporte', 'Confirme "resolvido" em 1 reporte', 'diaria', 'resolucoes', 1, 200, 40),
  ('weekly_report_10', 'Reporte 10 problemas', 'Crie 10 reportes esta semana', 'semanal', 'reportes', 10, 500, 100),
  ('weekly_confirm_10', 'Confirme 10 reportes', 'Confirme "continua" em 10 reportes', 'semanal', 'confirmacoes', 10, 300, 60),
  ('weekly_resolve_3', 'Resolva 3 reportes', 'Confirme "resolvido" em 3 reportes', 'semanal', 'resolucoes', 3, 600, 120),
  ('daily_pothole', 'Caça-buracos', 'Reporte 2 buracos no asfalto', 'diaria', 'reportes_categoria', 2, 100, 20),
  ('daily_lighting', 'Ilumine a cidade', 'Reporte 2 problemas de iluminação', 'diaria', 'reportes_categoria', 2, 100, 20),
  ('daily_trash', 'Cidade limpa', 'Reporte 2 lixos/entulhos', 'diaria', 'reportes_categoria', 2, 100, 20),
  ('weekly_all', 'Semana completa', 'Complete todas as missões diárias', 'semanal', 'reportes', 20, 1000, 200)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  metric = EXCLUDED.metric,
  category = EXCLUDED.category,
  target = EXCLUDED.target,
  reward_xp = EXCLUDED.reward_xp,
  reward_coins = EXCLUDED.reward_coins,
  active = EXCLUDED.active;

COMMENT ON TABLE public.mission_templates IS 'Modelos de missões diárias e semanais.';
COMMENT ON TABLE public.user_missions IS 'Progresso do usuário nas missões do período atual.';
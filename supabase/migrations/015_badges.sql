-- 015: Badges system
-- ============================================================================
-- Depends on: 001 (profiles), 005 (award_reward function)
-- Creates: badges, user_badges tables

-- Badges catalog table
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,           -- e.g. 'primeiro_reporte', 'vigilante_bairro'
  name text NOT NULL,                  -- Display name
  description text NOT NULL,           -- How to earn it
  icon text NOT NULL,                  -- Emoji or icon identifier
  category text NOT NULL CHECK (category IN ('reporte', 'confirmacao', 'streak', 'social', 'especial')),
  requirement_type text NOT NULL CHECK (requirement_type IN ('count', 'streak', 'level', 'unique_categories', 'distance', 'category_count', 'first')),
  requirement_value jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"count": 10} or {"count": 3, "category": "buraco_asfalto"}
  xp_reward int NOT NULL DEFAULT 0,    -- XP granted on earn
  coins_reward int NOT NULL DEFAULT 0, -- Coins granted on earn
  is_secret boolean NOT NULL DEFAULT false, -- Hidden until earned
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User earned badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  progress int NOT NULL DEFAULT 0,     -- Current progress toward requirement
  PRIMARY KEY (user_id, badge_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);

-- RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are readable by everyone (catalog)
DROP POLICY IF EXISTS "badges_read_all" ON public.badges;
CREATE POLICY "badges_read_all" ON public.badges
  FOR SELECT TO authenticated, anon USING (true);

-- User badges: users see their own, everyone sees earned badges for profiles
DROP POLICY IF EXISTS "user_badges_own" ON public.user_badges;
CREATE POLICY "user_badges_own" ON public.user_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_badges_read_all" ON public.user_badges;
CREATE POLICY "user_badges_read_all" ON public.user_badges
  FOR SELECT TO authenticated, anon USING (true);

-- Function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_profile public.profiles;
  v_badge public.badges;
  v_report_count int;
  v_confirmation_count int;
  v_unique_categories int;
  v_level int;
  v_streak int;
  v_req_count int;
  v_req_category text;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_level := v_profile.level;
  v_streak := v_profile.streak_count;

  -- Count user's reports
  SELECT count(*) INTO v_report_count FROM public.reports WHERE user_id = v_user_id;

  -- Count user's confirmations
  SELECT count(*) INTO v_confirmation_count FROM public.report_confirmations WHERE user_id = v_user_id;

  -- Count unique categories reported
  SELECT count(DISTINCT category) INTO v_unique_categories FROM public.reports WHERE user_id = v_user_id;

  -- Check each badge
  FOR v_badge IN SELECT * FROM public.badges WHERE NOT is_secret OR EXISTS (
    SELECT 1 FROM public.user_badges WHERE user_id = v_user_id AND badge_id = public.badges.id
  )
  LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    -- Evaluate requirement
    DECLARE
      v_met boolean := false;
      v_progress int := 0;
    BEGIN
      v_req_count := COALESCE((v_badge.requirement_value->>'count')::int, 0);
      v_req_category := v_badge.requirement_value->>'category';

      CASE v_badge.requirement_type
        WHEN 'count' THEN
          IF v_badge.category = 'reporte' THEN
            v_progress := v_report_count;
            v_met := v_report_count >= v_req_count;
          ELSIF v_badge.category = 'confirmacao' THEN
            v_progress := v_confirmation_count;
            v_met := v_confirmation_count >= v_req_count;
          END IF;
        WHEN 'streak' THEN
          v_progress := v_streak;
          v_met := v_streak >= v_req_count;
        WHEN 'level' THEN
          v_progress := v_level;
          v_met := v_level >= v_req_count;
        WHEN 'unique_categories' THEN
          v_progress := v_unique_categories;
          v_met := v_unique_categories >= v_req_count;
        WHEN 'category_count' THEN
          -- Count reports in specific category
          DECLARE
            v_cat_count int;
          BEGIN
            SELECT count(*) INTO v_cat_count FROM public.reports
            WHERE user_id = v_user_id AND category = v_req_category;
            v_progress := v_cat_count;
            v_met := v_cat_count >= v_req_count;
          END;
        WHEN 'first' THEN
          -- First time doing something (just check if count >= 1)
          v_progress := 1;
          v_met := true;
        WHEN 'distance' THEN
          -- Distance-based badges would need PostGIS calculation
          -- Skipping for now, could be implemented later
          v_progress := 0;
          v_met := false;
      END CASE;

      IF v_met THEN
        -- Award badge
        INSERT INTO public.user_badges (user_id, badge_id, progress)
        VALUES (v_user_id, v_badge.id, v_req_count)
        ON CONFLICT DO NOTHING;

        -- Award rewards
        IF v_badge.xp_reward > 0 OR v_badge.coins_reward > 0 THEN
          PERFORM public.award_reward(
            v_user_id,
            'badge_' || v_badge.code,
            v_badge.xp_reward,
            v_badge.coins_reward,
            'badge',
            v_badge.id
          );
        END IF;
      END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_award_badges TO authenticated;

-- Trigger to check badges after report creation
CREATE OR REPLACE FUNCTION public.trigger_badges_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_report ON public.reports;
CREATE TRIGGER trigger_badges_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.trigger_badges_on_report();

-- Trigger to check badges after confirmation
CREATE OR REPLACE FUNCTION public.trigger_badges_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_confirmation ON public.report_confirmations;
CREATE TRIGGER trigger_badges_on_confirmation
  AFTER INSERT ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_badges_on_confirmation();

-- Seed default badges (matching frontend BADGE_ORDER and UI expectations)
INSERT INTO public.badges (code, name, description, icon, category, requirement_type, requirement_value, xp_reward, coins_reward) VALUES
  -- Reporte badges (matching BADGE_ORDER in perfil/page.tsx)
  ('primeiro_reporte', 'Primeiro Reporte', 'Envie seu primeiro reporte', '🎯', 'reporte', 'first', '{}'::jsonb, 50, 10),
  ('cinco_reportes_confirmados', '5 Reportes Confirmados', 'Tenha 5 reportes confirmados pela comunidade', '✅', 'reporte', 'count', '{"count": 5}'::jsonb, 200, 50),
  ('dez_confirmacoes', '10 Confirmações', 'Faça 10 confirmações de problemas', '🔍', 'confirmacao', 'count', '{"count": 10}'::jsonb, 300, 50),
  ('primeiro_resolvido', 'Primeiro Resolvido', 'Tenha seu primeiro reporte resolvido', '🏆', 'especial', 'first', '{}'::jsonb, 500, 100),
  ('cacador_de_buracos', 'Caçador de Buracos', 'Reporte 10 buracos no asfalto', '🕳️', 'reporte', 'category_count', '{"count": 10, "category": "buraco_asfalto"}'::jsonb, 400, 80),
  ('guardiao_da_luz', 'Guardião da Luz', 'Reporte 10 problemas de iluminação', '💡', 'reporte', 'category_count', '{"count": 10, "category": "iluminacao"}'::jsonb, 400, 80),
  ('cidade_limpa', 'Cidade Limpa', 'Reporte 10 problemas de lixo e entulho', '🗑️', 'reporte', 'category_count', '{"count": 10, "category": "lixo_entulho"}'::jsonb, 400, 80),

  -- Additional badges for completeness
  ('reporteiro', 'Reporteiro', 'Envie 10 reportes', '📝', 'reporte', 'count', '{"count": 10}'::jsonb, 200, 50),
  ('vigilante_bairro', 'Vigilante do Bairro', 'Envie 50 reportes', '🏘️', 'reporte', 'count', '{"count": 50}'::jsonb, 1000, 200),
  ('cidadao_exemplar', 'Cidadão Exemplar', 'Envie 100 reportes', '🏆', 'reporte', 'count', '{"count": 100}'::jsonb, 2500, 500),

  -- Confirmation badges
  ('confirmador', 'Confirmador', 'Confirme 5 problemas', '✅', 'confirmacao', 'count', '{"count": 5}'::jsonb, 100, 20),
  ('fiscal', 'Fiscal', 'Confirme 25 problemas', '🔍', 'confirmacao', 'count', '{"count": 25}'::jsonb, 500, 100),
  ('guardiao', 'Guardião', 'Confirme 100 problemas', '🛡️', 'confirmacao', 'count', '{"count": 100}'::jsonb, 2000, 300),

  -- Streak badges
  ('estreante', 'Estreante', 'Mantenha streak de 3 dias', '🔥', 'streak', 'streak', '{"count": 3}'::jsonb, 100, 20),
  ('constante', 'Constante', 'Mantenha streak de 7 dias', '🔥🔥', 'streak', 'streak', '{"count": 7}'::jsonb, 300, 50),
  ('dedicado', 'Dedicado', 'Mantenha streak de 14 dias', '🔥🔥🔥', 'streak', 'streak', '{"count": 14}'::jsonb, 800, 150),
  ('incansavel', 'Incansável', 'Mantenha streak de 30 dias', '🔥🔥🔥🔥', 'streak', 'streak', '{"count": 30}'::jsonb, 2000, 500),

  -- Level badges
  ('novato', 'Novato', 'Alcance nível 5', '⭐', 'especial', 'level', '{"count": 5}'::jsonb, 200, 50),
  ('experiente', 'Experiente', 'Alcance nível 10', '⭐⭐', 'especial', 'level', '{"count": 10}'::jsonb, 500, 100),
  ('mestre', 'Mestre', 'Alcance nível 20', '⭐⭐⭐', 'especial', 'level', '{"count": 20}'::jsonb, 1500, 300),
  ('lenda', 'Lenda', 'Alcance nível 50', '👑', 'especial', 'level', '{"count": 50}'::jsonb, 5000, 1000),

  -- Category diversity badges
  ('explorador', 'Explorador', 'Reporte em 3 categorias diferentes', '🗺️', 'social', 'unique_categories', '{"count": 3}'::jsonb, 300, 50),
  ('polivalente', 'Polivalente', 'Reporte em 5 categorias diferentes', '🎨', 'social', 'unique_categories', '{"count": 5}'::jsonb, 800, 150),
  ('completo', 'Completo', 'Reporte em todas as 9 categorias', '🌈', 'social', 'unique_categories', '{"count": 9}'::jsonb, 2000, 500)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.badges IS 'Catálogo de conquistas do jogo';
COMMENT ON TABLE public.user_badges IS 'Badges conquistados pelos usuários';
COMMENT ON FUNCTION public.check_and_award_badges IS 'Verifica e concede badges baseados no progresso do usuário';
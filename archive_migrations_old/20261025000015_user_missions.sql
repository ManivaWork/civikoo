-- 15: User Missions + get_my_missions RPC
-- ============================================================================

CREATE TABLE public.user_missions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.mission_templates(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    progress int NOT NULL DEFAULT 0 CHECK (progress >= 0),
    completed_at timestamptz,
    claimed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, template_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user_period ON public.user_missions(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_user_missions_template ON public.user_missions(template_id);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_missions_own_select" ON public.user_missions;
CREATE POLICY "user_missions_own_select"
    ON public.user_missions FOR SELECT
    USING (user_id = auth.uid());

COMMENT ON TABLE public.user_missions IS 'Missões geradas para o usuário no período atual (diário/semanal). Progresso atualizado por triggers internos.';

-- ============================================================================
-- HELPER: current period start in America/Sao_Paulo timezone
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_period_start(p_type text)
RETURNS date LANGUAGE sql IMMUTABLE SECURITY DEFINER AS $$
    SELECT CASE
        WHEN p_type = 'diaria' THEN
            (now() AT TIME ZONE 'America/Sao_Paulo')::date
        WHEN p_type = 'semanal' THEN
            date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date
        ELSE NULL
    END;
$$;

COMMENT ON FUNCTION public.get_period_start IS 'Retorna o início do período atual (dia ou semana) no fuso America/Sao_Paulo';

-- ============================================================================
-- RPC: get_my_missions()
-- Cria missões do período atual se não existirem e retorna com progresso
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_missions()
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_daily_start date;
    v_weekly_start date;
    v_template public.mission_templates%rowtype;
    v_user_mission public.user_missions%rowtype;
    v_result jsonb;
BEGIN
    -- Exige usuário autenticado
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Calcula início dos períodos no fuso BRT
    v_daily_start := public.get_period_start('diaria');
    v_weekly_start := public.get_period_start('semanal');

    -- 1. Garante 3 missões diárias aleatórias ativas
    FOR v_template IN
        SELECT * FROM public.mission_templates
        WHERE type = 'diaria' AND active = true
        ORDER BY random()
        LIMIT 3
    LOOP
        INSERT INTO public.user_missions (user_id, template_id, period_start, progress)
        VALUES (v_user_id, v_template.id, v_daily_start, 0)
        ON CONFLICT (user_id, template_id, period_start) DO NOTHING;
    END LOOP;

    -- 2. Garante 2 missões semanais aleatórias ativas
    FOR v_template IN
        SELECT * FROM public.mission_templates
        WHERE type = 'semanal' AND active = true
        ORDER BY random()
        LIMIT 2
    LOOP
        INSERT INTO public.user_missions (user_id, template_id, period_start, progress)
        VALUES (v_user_id, v_template.id, v_weekly_start, 0)
        ON CONFLICT (user_id, template_id, period_start) DO NOTHING;
    END LOOP;

    -- 3. Retorna todas as missões do usuário para os períodos atuais com detalhes do template
    FOR v_user_mission IN
        SELECT um.*, mt.code, mt.title, mt.description, mt.type, mt.metric, mt.category, mt.target, mt.reward_xp, mt.reward_coins
        FROM public.user_missions um
        JOIN public.mission_templates mt ON mt.id = um.template_id
        WHERE um.user_id = v_user_id
          AND um.period_start IN (v_daily_start, v_weekly_start)
        ORDER BY
            CASE mt.type WHEN 'diaria' THEN 1 ELSE 2 END,
            um.created_at
    LOOP
        v_result := jsonb_build_object(
            'id', v_user_mission.id,
            'user_id', v_user_mission.user_id,
            'template_id', v_user_mission.template_id,
            'period_start', v_user_mission.period_start,
            'progress', v_user_mission.progress,
            'completed_at', v_user_mission.completed_at,
            'claimed_at', v_user_mission.claimed_at,
            'template', jsonb_build_object(
                'id', v_user_mission.template_id,
                'code', v_user_mission.code,
                'title', v_user_mission.title,
                'description', v_user_mission.description,
                'type', v_user_mission.type,
                'metric', v_user_mission.metric,
                'category', v_user_mission.category,
                'target', v_user_mission.target,
                'reward_xp', v_user_mission.reward_xp,
                'reward_coins', v_user_mission.reward_coins
            ),
            'is_completed', v_user_mission.progress >= v_user_mission.target AND v_user_mission.completed_at IS NOT NULL,
            'is_claimed', v_user_mission.claimed_at IS NOT NULL,
            'can_claim', v_user_mission.progress >= v_user_mission.target AND v_user_mission.claimed_at IS NULL
        );
        RETURN NEXT v_result;
    END LOOP;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_missions TO authenticated;

COMMENT ON FUNCTION public.get_my_missions IS 'Retorna as missões do usuário para o período atual (3 diárias + 2 semanais). Cria se não existirem. Inclui progresso, template e flags de conclusão/resgate.';
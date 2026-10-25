-- 18: Streak Update Function
-- ============================================================================
-- Atualiza a sequência diária (streak) na primeira ação válida do dia
-- Chamada por triggers em reports e report_confirmations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_profile public.profiles%rowtype;
    v_yesterday date := v_today - INTERVAL '1 day';
    v_milestone record;
BEGIN
    -- Busca perfil com lock para evitar race conditions
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Se já teve atividade hoje, não faz nada (idempotente por dia)
    IF v_profile.last_active_date = v_today THEN
        RETURN;
    END IF;

    -- Calcula novo streak
    IF v_profile.last_active_date = v_yesterday THEN
        -- Atividade ontem: continua a sequência
        UPDATE public.profiles
        SET streak_count = streak_count + 1,
            last_active_date = v_today,
            best_streak = GREATEST(best_streak, streak_count + 1)
        WHERE id = p_user_id;
    ELSE
        -- Pulou um ou mais dias: reinicia em 1
        UPDATE public.profiles
        SET streak_count = 1,
            last_active_date = v_today,
            best_streak = GREATEST(best_streak, 1)
        WHERE id = p_user_id;
    END IF;

    -- Verifica e concede marcos de streak (3, 7, 14, 30 dias)
    -- Busca o streak atualizado
    SELECT streak_count INTO v_profile.streak_count
    FROM public.profiles WHERE id = p_user_id;

    FOR v_milestone IN
        SELECT sm.id, sm.reward_xp, sm.reward_coins, sm.description
        FROM public.streak_milestones sm
        WHERE sm.id <= v_profile.streak_count
          AND sm.id NOT IN (SELECT milestone_days FROM public.user_streak_milestones WHERE user_id = p_user_id)
    LOOP
        -- Registra marco como conquistado
        INSERT INTO public.user_streak_milestones (user_id, milestone_days)
        VALUES (p_user_id, v_milestone.id)
        ON CONFLICT DO NOTHING;

        -- Concede recompensa via reward_events (tipo 'streak_milestone')
        INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
        VALUES (
            p_user_id,
            NULL, -- sem report_id para marcos de streak
            'streak_milestone',
            v_milestone.reward_xp,
            v_milestone.reward_coins,
            'pendente'
        );
    END LOOP;

    RETURN;
END;
$$;

COMMENT ON FUNCTION public.update_streak IS 'Atualiza streak_count do usuário. +1 se ativo ontem, reinicia em 1 se pulou dia. Concede marcos (3,7,14,30) uma única vez via reward_events.';

-- ============================================================================
-- Adicionar 'streak_milestone' ao CHECK constraint de reward_events.type
-- ============================================================================
ALTER TABLE public.reward_events
DROP CONSTRAINT IF EXISTS reward_events_type_check;

ALTER TABLE public.reward_events
ADD CONSTRAINT reward_events_type_check
CHECK (type IN ('reporte','confirmacao','resolucao','streak_milestone','missao'));

COMMENT ON COLUMN public.reward_events.type IS 'reporte | confirmacao | resolucao | streak_milestone | missao';

-- ============================================================================
-- Trigger AFTER INSERT on reports: update streak (se não oculto)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_streak_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.hidden IS NOT TRUE THEN
        PERFORM public.update_streak(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_streak_on_report ON public.reports;
CREATE TRIGGER trg_streak_on_report
    AFTER INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_on_report();

-- ============================================================================
-- Trigger AFTER INSERT on report_confirmations: update streak
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_streak_on_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.update_streak(NEW.user_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_streak_on_confirmation ON public.report_confirmations;
CREATE TRIGGER trg_streak_on_confirmation
    AFTER INSERT ON public.report_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_on_confirmation();

GRANT EXECUTE ON FUNCTION public.update_streak TO authenticated;
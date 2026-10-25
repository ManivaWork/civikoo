-- 19: Claim Mission RPC
-- ============================================================================
-- Resgata recompensa de missão concluída, credita XP/coins via reward_events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_mission(p_user_mission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_mission public.user_missions%rowtype;
    v_template public.mission_templates%rowtype;
    v_reward_event_id bigint;
    v_result jsonb;
BEGIN
    -- Exige usuário autenticado
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Busca a missão do usuário com lock
    SELECT um.*, mt.reward_xp, mt.reward_coins, mt.title
    INTO v_mission
    FROM public.user_missions um
    JOIN public.mission_templates mt ON mt.id = um.template_id
    WHERE um.id = p_user_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Missão não encontrada.';
    END IF;

    -- Verifica se pertence ao usuário
    IF v_mission.user_id != v_user_id THEN
        RAISE EXCEPTION 'Missão não pertence a você.';
    END IF;

    -- Verifica se já foi concluída
    IF v_mission.completed_at IS NULL THEN
        RAISE EXCEPTION 'Missão ainda não foi concluída.';
    END IF;

    -- Verifica se já foi resgatada
    IF v_mission.claimed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Missão já foi resgatada.';
    END IF;

    -- Cria reward_event para a missão (tipo 'missao')
    INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
    VALUES (v_user_id, NULL, 'missao', v_mission.reward_xp, v_mission.reward_coins, 'pendente')
    RETURNING id INTO v_reward_event_id;

    -- Libera imediatamente (missões são creditadas na hora)
    PERFORM public.release_reward(v_reward_event_id);

    -- Marca missão como resgatada
    UPDATE public.user_missions
    SET claimed_at = now()
    WHERE id = p_user_mission_id;

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Missão "' || v_mission.title || '" resgatada!',
        'xp_earned', v_mission.reward_xp,
        'coins_earned', v_mission.reward_coins
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mission TO authenticated;

COMMENT ON FUNCTION public.claim_mission IS 'Resgata recompensa de missão concluída e não resgatada. Cria reward_event tipo "missao" e libera imediatamente via release_reward.';
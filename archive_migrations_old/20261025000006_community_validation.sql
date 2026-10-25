-- 06: Community Validation with Server-Side Proximity Check
-- Tabela para confirmações da comunidade
CREATE TABLE public.report_confirmations (
    id bigserial PRIMARY KEY,
    report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('continua', 'resolvido')),
    user_lat double precision NOT NULL,
    user_lng double precision NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (report_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_report_confirmations_report_id ON public.report_confirmations (report_id);
CREATE INDEX IF NOT EXISTS idx_report_confirmations_user_id ON public.report_confirmations (user_id);

-- RLS: public SELECT, no INSERT/UPDATE/DELETE by client
ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_confirmations_public_select" ON public.report_confirmations;
CREATE POLICY "report_confirmations_public_select"
  ON public.report_confirmations FOR SELECT
  USING (true);
-- No INSERT/UPDATE/DELETE policies = denied by default (only server functions)

COMMENT ON TABLE public.report_confirmations IS 'Confirmações da comunidade: "continua" (problema persiste) ou "resolvido". Proximidade validada no servidor via RPC.';
COMMENT ON COLUMN public.report_confirmations.type IS 'continua = problema ainda existe; resolvido = problema foi corrigido';
COMMENT ON COLUMN public.report_confirmations.user_lat IS 'Latitude do usuário no momento da confirmação (para validação de proximidade)';
COMMENT ON COLUMN public.report_confirmations.user_lng IS 'Longitude do usuário no momento da confirmação (para validação de proximidade)';

-- ============================================================================
-- RPC: confirm_report
-- Valida proximidade (<= 50m) no servidor usando PostGIS ST_DWithin em geography
-- Libera recompensas pendentes conforme regras do jogo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_report(
    p_report_id uuid,
    p_type text,
    p_lat double precision,
    p_lng double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_report public.reports%rowtype;
    v_distance_m double precision;
    v_confirmation_count integer;
    v_resolution_count integer;
    v_confirmer_id uuid := auth.uid();
    v_reward_event_id bigint;
    v_result jsonb;
BEGIN
    -- 1. Exige usuário autenticado
    IF v_confirmer_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado. Faça login para confirmar.';
    END IF;

    -- 2. Busca o reporte
    SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reporte não encontrado.';
    END IF;

    -- 3. Rejeita se o usuário for o autor ao confirmar 'continua'
    IF p_type = 'continua' AND v_report.user_id = v_confirmer_id THEN
        RAISE EXCEPTION 'Você não pode confirmar seu próprio reporte.';
    END IF;

    -- 4. Valida proximidade (<= 50 metros) usando ST_DWithin em geography
    -- Cria ponto do usuário a partir das coordenadas enviadas
    v_distance_m := ST_Distance(
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        v_report.location
    );

    IF v_distance_m > 50 THEN
        RAISE EXCEPTION 'Você precisa estar a até 50 m do local (você está a %.0f m)', v_distance_m;
    END IF;

    -- 5. Tenta inserir a confirmação (rejeita duplicadas via UNIQUE constraint)
    BEGIN
        INSERT INTO public.report_confirmations (report_id, user_id, type, user_lat, user_lng)
        VALUES (p_report_id, v_confirmer_id, p_type, p_lat, p_lng);
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Você já confirmou este reporte como "%".', p_type;
    END;

    -- 6. Lógica por tipo de confirmação
    IF p_type = 'continua' THEN
        -- Conta confirmações "continua" de OUTROS usuários (exceto autor)
        SELECT COUNT(*) INTO v_confirmation_count
        FROM public.report_confirmations
        WHERE report_id = p_report_id
          AND type = 'continua'
          AND user_id != v_report.user_id;

        -- Se é a primeira confirmação de outra pessoa, libera reward do autor e muda status
        IF v_confirmation_count = 1 AND v_report.status = 'aberto' THEN
            -- Libera reward_event pendente do autor (tipo 'reporte')
            SELECT id INTO v_reward_event_id
            FROM public.reward_events
            WHERE report_id = p_report_id
              AND user_id = v_report.user_id
              AND type = 'reporte'
              AND state = 'pendente'
            LIMIT 1;

            IF v_reward_event_id IS NOT NULL THEN
                PERFORM public.release_reward(v_reward_event_id);
            END IF;

            -- Muda status para 'confirmado'
            UPDATE public.reports
            SET status = 'confirmado', updated_at = now()
            WHERE id = p_report_id;
        END IF;

        -- Cria reward_event pendente para o confirmador (5 XP, 2 coins)
        PERFORM public.create_reward_on_confirmation(p_report_id, v_confirmer_id);

        -- Libera imediatamente para o confirmador (já está no local)
        SELECT id INTO v_reward_event_id
        FROM public.reward_events
        WHERE report_id = p_report_id
          AND user_id = v_confirmer_id
          AND type = 'confirmacao'
          AND state = 'pendente'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_reward_event_id IS NOT NULL THEN
            PERFORM public.release_reward(v_reward_event_id);
        END IF;

        v_result := jsonb_build_object(
            'success', true,
            'message', 'Confirmação registrada! O problema continua ativo.',
            'xp_earned', 5,
            'coins_earned', 2,
            'distance_m', round(v_distance_m)::int
        );

    ELSIF p_type = 'resolvido' THEN
        -- Conta usuários DIFERENTES que confirmaram 'resolvido'
        SELECT COUNT(DISTINCT user_id) INTO v_resolution_count
        FROM public.report_confirmations
        WHERE report_id = p_report_id
          AND type = 'resolvido';

        -- Cria reward_event pendente para o confirmador (20 XP, 5 coins)
        INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
        VALUES (v_confirmer_id, p_report_id, 'resolucao', 20, 5, 'pendente');

        -- Se atingiu 2 usuários diferentes, resolve o reporte
        IF v_resolution_count >= 2 AND v_report.status != 'resolvido' THEN
            -- Libera reward dos dois confirmadores
            FOR v_reward_event_id IN
                SELECT id FROM public.reward_events
                WHERE report_id = p_report_id
                  AND type = 'resolucao'
                  AND state = 'pendente'
            LOOP
                PERFORM public.release_reward(v_reward_event_id);
            END LOOP;

            -- Bônus para o autor original (5 XP)
            INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
            VALUES (v_report.user_id, p_report_id, 'resolucao', 5, 0, 'pendente');

            SELECT id INTO v_reward_event_id
            FROM public.reward_events
            WHERE report_id = p_report_id
              AND user_id = v_report.user_id
              AND type = 'resolucao'
              AND state = 'pendente'
            ORDER BY created_at DESC
            LIMIT 1;

            IF v_reward_event_id IS NOT NULL THEN
                PERFORM public.release_reward(v_reward_event_id);
            END IF;

            -- Marca reporte como resolvido (função já faz isso + seta resolved_at)
            PERFORM public.create_reward_on_resolution(p_report_id);
        END IF;

        -- Libera o reward do confirmador atual imediatamente
        SELECT id INTO v_reward_event_id
        FROM public.reward_events
        WHERE report_id = p_report_id
          AND user_id = v_confirmer_id
          AND type = 'resolucao'
          AND state = 'pendente'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_reward_event_id IS NOT NULL THEN
            PERFORM public.release_reward(v_reward_event_id);
        END IF;

        v_result := jsonb_build_object(
            'success', true,
            'message', CASE
                WHEN v_resolution_count >= 2 THEN 'Reporte marcado como resolvido! Obrigado pela ajuda.'
                ELSE 'Confirmação de resolução registrada. Precisamos de mais uma pessoa para confirmar.'
            END,
            'xp_earned', 20,
            'coins_earned', 5,
            'distance_m', round(v_distance_m)::int,
            'resolved', v_resolution_count >= 2
        );
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_report TO authenticated;

COMMENT ON FUNCTION public.confirm_report IS 'Confirma um reporte com validação de proximidade (<=50m). Tipos: "continua" ou "resolvido". Libera recompensas via reward_events.';

-- ============================================================================
-- RPC: reports_nearby
-- Retorna reportes próximos com distância em metros
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reports_nearby(
    p_lat double precision,
    p_lng double precision,
    p_radius_m double precision DEFAULT 1000
) RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    v_report RECORD;
BEGIN
    FOR v_report IN
        SELECT
            r.id,
            r.user_id,
            r.latitude,
            r.longitude,
            r.category,
            r.title,
            r.description,
            r.image_url,
            r.status,
            r.points,
            r.created_at,
            r.resolved_at,
            ST_Distance(r.location, v_user_point) AS distance_m,
            u.username as creator_username,
            u.avatar_url as creator_avatar,
            u.level as creator_level,
            (
                SELECT COUNT(*) FROM public.report_confirmations rc
                WHERE rc.report_id = r.id AND rc.type = 'continua'
            ) as confirmations_continua,
            (
                SELECT COUNT(*) FROM public.report_confirmations rc
                WHERE rc.report_id = r.id AND rc.type = 'resolvido'
            ) as confirmations_resolvido
        FROM public.reports r
        JOIN auth.users u ON r.user_id = u.id
        WHERE ST_DWithin(r.location, v_user_point, p_radius_m)
          AND r.status IN ('aberto', 'confirmado', 'resolvido')
        ORDER BY distance_m ASC
    LOOP
        RETURN NEXT jsonb_build_object(
            'id', v_report.id,
            'user_id', v_report.user_id,
            'latitude', v_report.latitude,
            'longitude', v_report.longitude,
            'category', v_report.category,
            'title', v_report.title,
            'description', v_report.description,
            'image_url', v_report.image_url,
            'status', v_report.status,
            'points', v_report.points,
            'created_at', v_report.created_at,
            'resolved_at', v_report.resolved_at,
            'distance_m', round(v_report.distance_m)::int,
            'creator_username', v_report.creator_username,
            'creator_avatar', v_report.creator_avatar,
            'creator_level', v_report.creator_level,
            'confirmations_continua', v_report.confirmations_continua,
            'confirmations_resolvido', v_report.confirmations_resolvido
        );
    END LOOP;
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reports_nearby TO anon, authenticated;

COMMENT ON FUNCTION public.reports_nearby IS 'Retorna reportes próximos (padrão 1km) com distância em metros. Usa ST_DWithin para busca espacial eficiente.';

-- ============================================================================
-- NOTA DE SEGURANÇA
-- ============================================================================
-- A localização enviada pelo cliente (p_lat, p_lng) pode ser falsificada.
-- Esta validação de proximidade no servidor (ST_DWithin) dificulta spoofing casual,
-- mas um atacante determinado pode enviar coordenadas falsas.
-- Mitigação futura (Passo 6): verificação de consistência de localização histórica,
-- rate limiting por área, análise de padrões de movimento, e/ou atestação de dispositivo.
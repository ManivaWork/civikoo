-- 07: Progression, Badges, and Ranking
-- ============================================================================
-- BADGES TABLE
-- ============================================================================
CREATE TABLE public.badges (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon text NOT NULL,
    category text NOT NULL DEFAULT 'geral', -- 'geral', 'reporte', 'confirmacao', 'categoria'
    requirement_type text NOT NULL, -- 'count', 'first', 'category_count'
    requirement_value jsonb NOT NULL DEFAULT '{}', -- flexible requirements
    xp_reward int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_badges_code ON public.badges(code);
CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_public_select" ON public.badges;
CREATE POLICY "badges_public_select"
  ON public.badges FOR SELECT
  USING (true);
-- No INSERT/UPDATE/DELETE policies = denied by default

COMMENT ON TABLE public.badges IS 'Definição de medalhas/conquistas do jogo';
COMMENT ON COLUMN public.badges.requirement_type IS 'Tipo do requisito: count, first, category_count';
COMMENT ON COLUMN public.badges.requirement_value IS 'Valor do requisito em JSON (ex: {"category": "buraco_asfalto", "count": 5})';

-- ============================================================================
-- USER_BADGES TABLE
-- ============================================================================
CREATE TABLE public.user_badges (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges_public_select" ON public.user_badges;
CREATE POLICY "user_badges_public_select"
  ON public.user_badges FOR SELECT
  USING (true);
-- No direct client writes

COMMENT ON TABLE public.user_badges IS 'Medalhas conquistadas pelos usuários';

-- ============================================================================
-- INITIAL BADGES
-- ============================================================================
INSERT INTO public.badges (code, name, description, icon, category, requirement_type, requirement_value, xp_reward) VALUES
('primeiro_reporte', 'Primeiro Relatório', 'Envie seu primeiro relato de problema', '🎯', 'reporte', 'first', '{"table": "reports"}', 50),
('cinco_reportes_confirmados', 'Reporter Confiável', 'Tenha 5 reportes seus confirmados pela comunidade', '✅', 'reporte', 'count', '{"table": "reports", "status": "confirmado", "count": 5}', 200),
('dez_confirmacoes', 'Verificador Ativo', 'Realize 10 confirmações de problemas', '🔍', 'confirmacao', 'count', '{"table": "report_confirmations", "type": "continua", "count": 10}', 150),
('primeiro_resolvido', 'Problema Resolvido', 'Tenha um reporte seu marcado como resolvido', '🏆', 'reporte', 'first', '{"table": "reports", "status": "resolvido"}', 100),
('cacador_de_buracos', 'Caçador de Buracos', 'Reporte 5 buracos no asfalto', '🕳️', 'categoria', 'category_count', '{"category": "buraco_asfalto", "count": 5}', 300),
('guardiao_da_luz', 'Guardião da Luz', 'Reporte 5 problemas de iluminação', '💡', 'categoria', 'category_count', '{"category": "iluminacao", "count": 5}', 300),
('cidade_limpa', 'Cidade Limpa', 'Reporte 5 problemas de lixo/entulho', '🗑️', 'categoria', 'category_count', '{"category": "lixo_entulho", "count": 5}', 300)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- FUNCTION: title_for_level
-- ============================================================================
CREATE OR REPLACE FUNCTION public.title_for_level(p_level int)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN p_level <= 2 THEN 'Observador'
    WHEN p_level <= 5 THEN 'Fiscal de Calçada'
    WHEN p_level <= 9 THEN 'Guardião do Bairro'
    ELSE 'Protetor da Cidade'
  END;
$$;

COMMENT ON FUNCTION public.title_for_level IS 'Retorna o título correspondente ao nível do jogador';

-- ============================================================================
-- FUNCTION: check_badges
-- Verifica e concede medalhas pendentes para um usuário
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_badges(p_user_id uuid)
RETURNS SETOF public.badges LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_badge public.badges%rowtype;
    v_earned_count int;
    v_query text;
    v_result int;
BEGIN
    -- Iterate over all badges not yet earned by user
    FOR v_badge IN
        SELECT b.* FROM public.badges b
        WHERE b.id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
    LOOP
        v_earned_count := 0;

        CASE v_badge.requirement_type
            WHEN 'first' THEN
                -- Check if user has at least 1 record in specified table with conditions
                v_query := format(
                    'SELECT COUNT(*) FROM %I WHERE user_id = $1',
                    (v_badge.requirement_value->>'table')::text
                );
                IF v_badge.requirement_value ? 'status' THEN
                    v_query := v_query || format(' AND status = %L', (v_badge.requirement_value->>'status')::text);
                END IF;
                EXECUTE v_query INTO v_result USING p_user_id;
                v_earned_count := v_result;

            WHEN 'count' THEN
                -- Count records in table with optional filters
                v_query := format(
                    'SELECT COUNT(*) FROM %I WHERE %I = $1',
                    (v_badge.requirement_value->>'table')::text,
                    CASE
                        WHEN (v_badge.requirement_value->>'table')::text = 'report_confirmations' THEN 'verifier_id'
                        ELSE 'user_id'
                    END
                );
                IF v_badge.requirement_value ? 'type' THEN
                    v_query := v_query || format(' AND type = %L', (v_badge.requirement_value->>'type')::text);
                END IF;
                IF v_badge.requirement_value ? 'status' THEN
                    v_query := v_query || format(' AND status = %L', (v_badge.requirement_value->>'status')::text);
                END IF;
                EXECUTE v_query INTO v_result USING p_user_id;
                v_earned_count := v_result;

            WHEN 'category_count' THEN
                -- Count reports by category
                v_query := format(
                    'SELECT COUNT(*) FROM reports WHERE user_id = $1 AND category = %L',
                    (v_badge.requirement_value->>'category')::text
                );
                EXECUTE v_query INTO v_result USING p_user_id;
                v_earned_count := v_result;
        END CASE;

        -- Check if requirement met
        IF v_earned_count >= COALESCE((v_badge.requirement_value->>'count')::int, 1) THEN
            -- Award badge
            INSERT INTO public.user_badges (user_id, badge_id)
            VALUES (p_user_id, v_badge.id)
            ON CONFLICT DO NOTHING;

            -- Award XP if any
            IF v_badge.xp_reward > 0 THEN
                PERFORM public.increment_user_score(p_user_id, v_badge.xp_reward, 'badge', v_badge.id);
            END IF;

            -- Return the earned badge
            RETURN NEXT v_badge;
        END IF;
    END LOOP;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_badges TO authenticated;

COMMENT ON FUNCTION public.check_badges IS 'Verifica e concede medalhas pendentes para um usuário. Retorna as medalhas recém-conquistadas.';

-- ============================================================================
-- TRIGGER: Call check_badges after report insert and confirmation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.check_badges(NEW.user_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_badges_on_report ON public.reports;
CREATE TRIGGER trg_check_badges_on_report
    AFTER INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_check_badges_on_report();

CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.check_badges(NEW.verifier_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_badges_on_confirmation ON public.report_confirmations;
CREATE TRIGGER trg_check_badges_on_confirmation
    AFTER INSERT ON public.report_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_check_badges_on_confirmation();

-- Also check badges when report status changes to confirmado/resolvido
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status IN ('confirmado', 'resolvido') AND NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM public.check_badges(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_badges_on_status_change ON public.reports;
CREATE TRIGGER trg_check_badges_on_status_change
    AFTER UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_check_badges_on_status_change();

-- ============================================================================
-- VIEW: leaderboard_weekly (top 20 by XP earned in last 7 days from released rewards)
-- ============================================================================
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.level,
    COALESCE(SUM(re.xp), 0) as weekly_xp,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(re.xp), 0) DESC) as rank
FROM public.profiles u
LEFT JOIN public.reward_events re ON re.user_id = u.id
    AND re.state = 'liberado'
    AND re.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.username, u.avatar_url, u.level
ORDER BY weekly_xp DESC
LIMIT 20;

COMMENT ON VIEW public.leaderboard_weekly IS 'Ranking semanal: top 20 por XP ganho nos últimos 7 dias (rewards liberados)';

-- ============================================================================
-- VIEW: leaderboard_overall (ranking geral por XP total)
-- ============================================================================
CREATE OR REPLACE VIEW public.leaderboard_overall AS
SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.level,
    u.total_score as xp,
    ROW_NUMBER() OVER (ORDER BY u.total_score DESC) as rank
FROM public.profiles u
ORDER BY u.total_score DESC;

COMMENT ON VIEW public.leaderboard_overall IS 'Ranking geral: todos usuários ordenados por XP total';

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;
GRANT SELECT ON public.leaderboard_overall TO anon, authenticated;
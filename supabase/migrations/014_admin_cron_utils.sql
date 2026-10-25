-- 014: Admin functions, cron jobs, and utilities
-- ============================================================================
-- Depends on: 001 (profiles), 002 (reports), 003 (report_confirmations),
--             005 (reward_events), 007 (mission_templates, user_missions),
--             008 (items, user_items, user_equipped_items), 010 (rate_limit_log, fraud_alerts)

-- Function to ban user (admin only via service role)
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET banned = true, ban_reason = p_reason, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_user TO authenticated;

-- Function to unban user (admin only via service role)
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET banned = false, ban_reason = NULL, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unban_user TO authenticated;

-- Function to hide/unhide report (admin)
CREATE OR REPLACE FUNCTION public.set_report_hidden(p_report_id uuid, p_hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.reports
  SET hidden = p_hidden, updated_at = now()
  WHERE id = p_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_report_hidden TO authenticated;

-- Function to get report stats (for admin dashboard)
CREATE OR REPLACE FUNCTION public.get_report_stats()
RETURNS TABLE (
  total_reports bigint,
  active_reports bigint,
  resolved_reports bigint,
  hidden_reports bigint,
  total_users bigint,
  active_users_24h bigint,
  total_xp_awarded bigint,
  total_coins_awarded bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.reports)::bigint,
    (SELECT count(*) FROM public.reports WHERE status = 'ativo')::bigint,
    (SELECT count(*) FROM public.reports WHERE status = 'resolvido')::bigint,
    (SELECT count(*) FROM public.reports WHERE hidden = true)::bigint,
    (SELECT count(*) FROM public.profiles WHERE banned = false)::bigint,
    (SELECT count(*) FROM public.profiles WHERE last_active_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 day')::bigint,
    (SELECT COALESCE(SUM(amount_xp), 0) FROM public.reward_events)::bigint,
    (SELECT COALESCE(SUM(amount_coins), 0) FROM public.reward_events)::bigint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_stats TO authenticated;

-- Function to clean up old rate_limit_log (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log(p_older_than_days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - (p_older_than_days || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_log TO authenticated;

-- Function to clean up old fraud_alerts (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_fraud_alerts(p_older_than_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.fraud_alerts
  WHERE created_at < now() - (p_older_than_days || ' days')::interval
    AND reviewed = true;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_fraud_alerts TO authenticated;

-- Function to get user's public profile (for report cards, leaderboard)
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  level int,
  xp bigint,
  total_score bigint,
  streak_count int,
  best_streak int,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url, p.level, p.xp, p.total_score,
         p.streak_count, p.best_streak, p.created_at
  FROM public.profiles p
  WHERE p.id = p_user_id AND p.banned = false;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile TO anon, authenticated;

-- Function to get user's equipped items with item details
CREATE OR REPLACE FUNCTION public.get_user_avatar(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  slot public.item_slot,
  item_id uuid,
  item_code text,
  item_name text,
  item_rarity public.item_rarity,
  item_asset text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_equipped public.user_equipped_items;
BEGIN
  SELECT * INTO v_equipped FROM public.user_equipped_items WHERE user_id = v_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    'cabeca'::public.item_slot, v_equipped.cabeca, i.code, i.name, i.rarity, i.asset
  FROM public.items i WHERE i.id = v_equipped.cabeca
  UNION ALL
  SELECT
    'corpo'::public.item_slot, v_equipped.corpo, i.code, i.name, i.rarity, i.asset
  FROM public.items i WHERE i.id = v_equipped.corpo
  UNION ALL
  SELECT
    'acessorio'::public.item_slot, v_equipped.acessorio, i.code, i.name, i.rarity, i.asset
  FROM public.items i WHERE i.id = v_equipped.acessorio
  UNION ALL
  SELECT
    'fundo'::public.item_slot, v_equipped.fundo, i.code, i.name, i.rarity, i.asset
  FROM public.items i WHERE i.id = v_equipped.fundo;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_avatar TO anon, authenticated;

COMMENT ON FUNCTION public.ban_user IS 'Banir usuário (admin).';
COMMENT ON FUNCTION public.unban_user IS 'Desbanir usuário (admin).';
COMMENT ON FUNCTION public.set_report_hidden IS 'Ocultar/mostrar reporte (admin).';
COMMENT ON FUNCTION public.get_report_stats IS 'Estatísticas gerais para dashboard admin.';
COMMENT ON FUNCTION public.cleanup_rate_limit_log IS 'Limpa logs de rate limit antigos (cron).';
COMMENT ON FUNCTION public.cleanup_fraud_alerts IS 'Limpa alertas de fraude antigos revisados (cron).';
COMMENT ON FUNCTION public.get_public_profile IS 'Perfil público para cards de reporte, ranking.';
COMMENT ON FUNCTION public.get_user_avatar IS 'Itens equipados do avatar com detalhes.';
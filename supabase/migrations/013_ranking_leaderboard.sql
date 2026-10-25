-- 013: Ranking & Leaderboards
-- ============================================================================
-- Depends on: 001 (profiles with banned column), 005 (reward_events)

-- Materialized view for leaderboard (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard AS
SELECT
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.level,
  p.xp,
  p.coins,
  p.total_score,
  p.streak_count,
  p.best_streak,
  ROW_NUMBER() OVER (ORDER BY p.total_score DESC, p.xp DESC) as rank
FROM public.profiles p
WHERE p.banned = false
ORDER BY p.total_score DESC, p.xp DESC
LIMIT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_user_idx ON public.leaderboard (user_id);

-- Function to refresh leaderboard (called by cron)
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_leaderboard TO authenticated;

-- Function to get user's rank
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (rank int, total_users int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(l.rank, (SELECT count(*) FROM public.profiles WHERE total_score > (SELECT total_score FROM public.profiles WHERE id = v_user_id)) + 1)::int,
    (SELECT count(*) FROM public.profiles WHERE banned = false)::int
  FROM public.leaderboard l
  WHERE l.user_id = v_user_id;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rank TO anon, authenticated;

-- Function to get leaderboard page
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (
  rank int,
  user_id uuid,
  username text,
  avatar text,
  level int,
  xp int,
  coins int,
  total_score int,
  streak_count int,
  best_streak int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT l.rank, l.user_id, l.username, l.avatar_url, l.level, l.xp, l.coins,
         l.total_score, l.streak_count, l.best_streak
  FROM public.leaderboard l
  ORDER BY l.rank
  LIMIT p_limit OFFSET p_offset;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon, authenticated;

-- Weekly leaderboard (for weekly competitions)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.weekly_leaderboard AS
SELECT
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.level,
  COALESCE(SUM(re.amount_xp), 0) as weekly_xp,
  COALESCE(SUM(re.amount_coins), 0) as weekly_coins,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(re.amount_xp), 0) DESC) as rank
FROM public.profiles p
LEFT JOIN public.reward_events re ON re.user_id = p.id
  AND re.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - (EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int || ' days')::interval
  AND re.created_at < (now() AT TIME ZONE 'America/Sao_Paulo')::date - (EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int || ' days')::interval + interval '7 days'
WHERE p.banned = false
GROUP BY p.id, p.username, p.avatar_url, p.level
ORDER BY weekly_xp DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_leaderboard_user_idx ON public.weekly_leaderboard (user_id);

CREATE OR REPLACE FUNCTION public.refresh_weekly_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_weekly_leaderboard TO authenticated;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (
  rank int,
  user_id uuid,
  username text,
  avatar text,
  level int,
  weekly_xp bigint,
  weekly_coins bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT l.rank, l.user_id, l.username, l.avatar_url, l.level, l.weekly_xp, l.weekly_coins
  FROM public.weekly_leaderboard l
  ORDER BY l.rank
  LIMIT p_limit OFFSET p_offset;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard TO anon, authenticated;

-- Function to get user's weekly rank
CREATE OR REPLACE FUNCTION public.get_user_weekly_rank(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (rank int, weekly_xp bigint, weekly_coins bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(l.rank, 0)::int,
    COALESCE(l.weekly_xp, 0),
    COALESCE(l.weekly_coins, 0)
  FROM public.weekly_leaderboard l
  WHERE l.user_id = v_user_id;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_weekly_rank TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.leaderboard IS 'Ranking geral por total_score (XP total). Atualizado via cron.';
COMMENT ON MATERIALIZED VIEW public.weekly_leaderboard IS 'Ranking semanal por XP ganho na semana. Atualizado via cron.';
COMMENT ON FUNCTION public.get_user_rank IS 'Retorna posição do usuário no ranking geral.';
COMMENT ON FUNCTION public.get_leaderboard IS 'Retorna página do ranking geral.';
COMMENT ON FUNCTION public.get_weekly_leaderboard IS 'Retorna página do ranking semanal.';
COMMENT ON FUNCTION public.get_user_weekly_rank IS 'Retorna posição do usuário no ranking semanal.';
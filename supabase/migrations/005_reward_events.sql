-- 005: reward_events table (immutable audit log for XP/coins)
-- ============================================================================
-- Depends on: 001 (profiles)

CREATE TABLE IF NOT EXISTS public.reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'report_created', 'confirmation_continua', 'confirmation_resolvido', 'mission_claim', 'streak_milestone'
  amount_xp int NOT NULL DEFAULT 0,
  amount_coins int NOT NULL DEFAULT 0,
  ref_type text, -- 'report', 'mission', 'streak'
  ref_id uuid, -- report_id, mission_id, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reward_events_user_id_idx ON public.reward_events (user_id);
CREATE INDEX IF NOT EXISTS reward_events_source_idx ON public.reward_events (source);
CREATE INDEX IF NOT EXISTS reward_events_ref_idx ON public.reward_events (ref_type, ref_id);

-- RLS
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reward_events_select_own" ON public.reward_events;
CREATE POLICY "reward_events_select_own" ON public.reward_events
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies - only server-side functions can write

COMMENT ON TABLE public.reward_events IS 'Log imutável de concessão de XP e moedas. Apenas funções SECURITY DEFINER podem inserir.';

-- Function to award XP/coins atomically with duplicate protection
CREATE OR REPLACE FUNCTION public.award_reward(
  p_user_id uuid,
  p_source text,
  p_xp int DEFAULT 0,
  p_coins int DEFAULT 0,
  p_ref_type text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check for duplicate (same user, source, ref)
  IF p_ref_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.reward_events
      WHERE user_id = p_user_id
        AND source = p_source
        AND ref_type = p_ref_type
        AND ref_id = p_ref_id
    ) INTO v_exists;

    IF v_exists THEN
      RAISE EXCEPTION 'REWARD_ALREADY_CLAIMED: Já recebeu recompensa para esta referência';
    END IF;
  END IF;

  -- Atomic update of profiles + insert into reward_events
  UPDATE public.profiles
  SET xp = xp + p_xp,
      coins = coins + p_coins,
      total_score = total_score + p_xp,
      level = 1 + (xp + p_xp) / 1000, -- Simple level formula
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.reward_events (user_id, source, amount_xp, amount_coins, ref_type, ref_id)
  VALUES (p_user_id, p_source, p_xp, p_coins, p_ref_type, p_ref_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_reward TO authenticated;

-- Function to get user's total earned XP/coins from reward_events
CREATE OR REPLACE FUNCTION public.get_user_reward_summary(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_xp bigint,
  total_coins bigint,
  by_source jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount_xp), 0)::bigint,
    COALESCE(SUM(amount_coins), 0)::bigint,
    COALESCE(jsonb_object_agg(source, jsonb_build_object('xp', sum_xp, 'coins', sum_coins)), '{}'::jsonb)
  FROM (
    SELECT source,
           SUM(amount_xp) as sum_xp,
           SUM(amount_coins) as sum_coins
    FROM public.reward_events
    WHERE user_id = v_user_id
    GROUP BY source
  ) s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reward_summary TO anon, authenticated;
-- 05: Row Level Security (RLS) policies

-- ========================
-- reports
-- ========================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "reports_public_select" ON public.reports;
CREATE POLICY "reports_public_select"
  ON public.reports FOR SELECT
  USING (true);

-- Authenticated insert (user_id forced by trigger)
DROP POLICY IF EXISTS "reports_auth_insert" ON public.reports;
CREATE POLICY "reports_auth_insert"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Author can update own report (except protected cols blocked by trigger)
DROP POLICY IF EXISTS "reports_author_update" ON public.reports;
CREATE POLICY "reports_author_update"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Author can delete own report
DROP POLICY IF EXISTS "reports_author_delete" ON public.reports;
CREATE POLICY "reports_author_delete"
  ON public.reports FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ========================
-- profiles
-- ========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
CREATE POLICY "profiles_public_select"
  ON public.profiles FOR SELECT
  USING (true);

-- REVOKE UPDATE on all columns, then GRANT only on username
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username) ON public.profiles TO authenticated;

-- Authenticated can update ONLY username (enforced by column grants + policy)
DROP POLICY IF EXISTS "profiles_self_update_username" ON public.profiles;
CREATE POLICY "profiles_self_update_username"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========================
-- reward_events
-- ========================
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

-- User can see own events only
DROP POLICY IF EXISTS "reward_events_self_select" ON public.reward_events;
CREATE POLICY "reward_events_self_select"
  ON public.reward_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE by client (only server functions SECURITY DEFINER)
-- (No policies created = denied by default)

COMMENT ON POLICY "reports_public_select" ON public.reports IS 'Mapa público vê todos reportes';
COMMENT ON POLICY "reports_auth_insert" ON public.reports IS 'Logado pode inserir; user_id forçado pelo trigger';
COMMENT ON POLICY "profiles_self_update_username" ON public.profiles IS 'Usuário edita só username; xp/coins/level mudam só via SECURITY DEFINER functions';
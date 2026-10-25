-- 012: Comprehensive RLS Policies
-- ============================================================================
-- Depends on: all previous migrations (tables must exist)

-- Enable RLS on all tables (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streak_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipped_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Own profile: full access
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public profile info for leaderboards, report cards, etc.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

-- No INSERT - created by trigger on auth.users
-- No DELETE - account deletion via edge function

-- ============================================================
-- REPORTS
-- ============================================================
-- Visible reports: not hidden, any user can read
DROP POLICY IF EXISTS "reports_select_visible" ON public.reports;
CREATE POLICY "reports_select_visible" ON public.reports
  FOR SELECT USING (hidden = false);

-- Own reports: user can see their own even if hidden
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);

-- Create report: authenticated users only
DROP POLICY IF EXISTS "reports_insert_authenticated" ON public.reports;
CREATE POLICY "reports_insert_authenticated" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update: only own reports, only certain fields (status updated by triggers)
DROP POLICY IF EXISTS "reports_update_own" ON public.reports;
CREATE POLICY "reports_update_own" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE - soft delete via hidden=true

-- ============================================================
-- REPORT_CONFIRMATIONS
-- ============================================================
-- Read: anyone can see confirmations on visible reports
DROP POLICY IF EXISTS "confirmations_select_visible" ON public.report_confirmations;
CREATE POLICY "confirmations_select_visible" ON public.report_confirmations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_confirmations.report_id
        AND r.hidden = false
    )
  );

-- Own confirmations: can always see
DROP POLICY IF EXISTS "confirmations_select_own" ON public.report_confirmations;
CREATE POLICY "confirmations_select_own" ON public.report_confirmations
  FOR SELECT USING (auth.uid() = user_id);

-- Insert: authenticated users, not own report, within 50m (enforced by RPC)
DROP POLICY IF EXISTS "confirmations_insert_authenticated" ON public.report_confirmations;
CREATE POLICY "confirmations_insert_authenticated" ON public.report_confirmations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_confirmations.report_id
        AND r.user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE - confirmations are immutable

-- ============================================================
-- REWARD_EVENTS
-- ============================================================
-- Read: own rewards only
DROP POLICY IF EXISTS "reward_events_select_own" ON public.reward_events;
CREATE POLICY "reward_events_select_own" ON public.reward_events
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE - only server functions

-- ============================================================
-- USER_STREAK_MILESTONES
-- ============================================================
DROP POLICY IF EXISTS "streak_milestones_select_own" ON public.user_streak_milestones;
CREATE POLICY "streak_milestones_select_own" ON public.user_streak_milestones
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE - only server functions

-- ============================================================
-- MISSION_TEMPLATES
-- ============================================================
DROP POLICY IF EXISTS "templates_select_active" ON public.mission_templates;
CREATE POLICY "templates_select_active" ON public.mission_templates
  FOR SELECT USING (active = true);

-- ============================================================
-- USER_MISSIONS
-- ============================================================
DROP POLICY IF EXISTS "user_missions_select_own" ON public.user_missions;
CREATE POLICY "user_missions_select_own" ON public.user_missions
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE - managed by get_my_missions/claim_mission RPCs

-- ============================================================
-- ITEMS
-- ============================================================
DROP POLICY IF EXISTS "items_select_active" ON public.items;
CREATE POLICY "items_select_active" ON public.items
  FOR SELECT USING (active = true);

-- ============================================================
-- USER_ITEMS
-- ============================================================
DROP POLICY IF EXISTS "user_items_select_own" ON public.user_items;
CREATE POLICY "user_items_select_own" ON public.user_items
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- USER_EQUIPPED_ITEMS
-- ============================================================
DROP POLICY IF EXISTS "equipped_select_own" ON public.user_equipped_items;
CREATE POLICY "equipped_select_own" ON public.user_equipped_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipped_update_own" ON public.user_equipped_items;
CREATE POLICY "equipped_update_own" ON public.user_equipped_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REPORT_IMAGES
-- ============================================================
DROP POLICY IF EXISTS "report_images_select_visible" ON public.report_images;
CREATE POLICY "report_images_select_visible" ON public.report_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_images.report_id
        AND r.hidden = false
    )
  );

DROP POLICY IF EXISTS "report_images_insert_own_report" ON public.report_images;
CREATE POLICY "report_images_insert_own_report" ON public.report_images
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_images.report_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "report_images_delete_own" ON public.report_images;
CREATE POLICY "report_images_delete_own" ON public.report_images
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RATE_LIMIT_LOG
-- ============================================================
DROP POLICY IF EXISTS "rate_limit_log_select_own" ON public.rate_limit_log;
CREATE POLICY "rate_limit_log_select_own" ON public.rate_limit_log
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE - only server functions

-- ============================================================
-- FRAUD_ALERTS
-- ============================================================
DROP POLICY IF EXISTS "fraud_alerts_select_own" ON public.fraud_alerts;
CREATE POLICY "fraud_alerts_select_own" ON public.fraud_alerts
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for regular users - only service role

-- ============================================================
-- SERVICE ROLE (for edge functions, cron jobs, admin)
-- ============================================================
-- Service role bypasses RLS automatically when using service_role key
-- No additional policies needed

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS 'Usuário vê seu próprio perfil completo.';
COMMENT ON POLICY "profiles_select_public" ON public.profiles IS 'Dados públicos de perfil para ranking, cards de reporte.';
COMMENT ON POLICY "reports_select_visible" ON public.reports IS 'Reportes visíveis (não ocultados) para todos.';
COMMENT ON POLICY "reports_select_own" ON public.reports IS 'Usuário vê seus próprios reportes inclusive ocultados.';
COMMENT ON POLICY "reports_insert_authenticated" ON public.reports IS 'Apenas autenticados criam reportes (user_id = auth.uid()).';
COMMENT ON POLICY "confirmations_select_visible" ON public.report_confirmations IS 'Confirmações em reportes visíveis.';
COMMENT ON POLICY "confirmations_insert_authenticated" ON public.report_confirmations IS 'Autenticados confirmam (não próprio reporte, validação 50m no RPC).';
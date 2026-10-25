-- 003: report_confirmations table (single unified table)
-- ============================================================================
-- Depends on: 001 (profiles), 002 (reports, report_status enum)

CREATE TABLE IF NOT EXISTS public.report_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('continua', 'resolvido')),
  user_lat double precision NOT NULL,
  user_lng double precision NOT NULL,
  accuracy double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id, type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS report_confirmations_report_id_idx ON public.report_confirmations (report_id);
CREATE INDEX IF NOT EXISTS report_confirmations_user_id_idx ON public.report_confirmations (user_id);

-- Function to check if user can confirm (proximity + rate limit)
CREATE OR REPLACE FUNCTION public.can_confirm_report(
  p_report_id uuid,
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_report public.reports;
  v_distance double precision;
  v_confirmations_today int;
BEGIN
  -- Get report
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL OR v_report.hidden THEN
    RETURN false;
  END IF;

  -- Can't confirm own report
  IF v_report.user_id = p_user_id THEN
    RETURN false;
  END IF;

  -- Check distance (50m max)
  v_distance := ST_Distance(
    v_report.location,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  );
  IF v_distance > 50 THEN
    RETURN false;
  END IF;

  -- Check GPS accuracy (100m max)
  IF p_accuracy IS NOT NULL AND p_accuracy > 100 THEN
    RETURN false;
  END IF;

  -- Rate limit: max 30 confirmations per 24h per user
  SELECT count(*) INTO v_confirmations_today
  FROM public.report_confirmations
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '24 hours';
  IF v_confirmations_today >= 30 THEN
    RETURN false;
  END IF;

  -- Cooldown: 30 seconds between confirmations
  IF EXISTS (
    SELECT 1 FROM public.report_confirmations
    WHERE user_id = p_user_id
      AND created_at >= now() - interval '30 seconds'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_confirm_report TO anon, authenticated;

-- RLS
ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "confirmations_select_visible" ON public.report_confirmations;
CREATE POLICY "confirmations_select_visible" ON public.report_confirmations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_confirmations.report_id
        AND r.hidden = false
    )
  );

DROP POLICY IF EXISTS "confirmations_select_own" ON public.report_confirmations;
CREATE POLICY "confirmations_select_own" ON public.report_confirmations
  FOR SELECT USING (auth.uid() = user_id);

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

COMMENT ON TABLE public.report_confirmations IS 'Confirmações de reportes: type = continua ou resolvido. Uma por usuário por tipo.';
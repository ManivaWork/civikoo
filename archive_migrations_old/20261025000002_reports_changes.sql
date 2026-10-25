-- 03: Reports table changes (preserve existing validation triggers)

-- Add columns if not exist
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','confirmado','resolvido')),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Index for user reports
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports (user_id);

-- Trigger BEFORE INSERT: force server-side values, ignore client input
CREATE OR REPLACE FUNCTION public.enforce_report_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Force authenticated user as author
  NEW.user_id := auth.uid();

  -- Force initial status and points
  NEW.status := 'aberto';
  NEW.points := 10;  -- base reward for reporting

  -- Prevent client from setting resolved_at
  NEW.resolved_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_report_insert ON public.reports;
CREATE TRIGGER trg_enforce_report_insert
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_insert();

-- Prevent UPDATE of protected columns
CREATE OR REPLACE FUNCTION public.protect_report_protected_cols()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.points IS DISTINCT FROM OLD.points THEN
    RAISE EXCEPTION 'Column points cannot be modified by client';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Column status cannot be modified by client (use server functions)';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Column user_id cannot be modified';
  END IF;
  IF NEW.location IS DISTINCT FROM OLD.location THEN
    RAISE EXCEPTION 'Column location cannot be modified directly (use latitude/longitude)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_report_protected_cols ON public.reports;
CREATE TRIGGER trg_protect_report_protected_cols
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_report_protected_cols();

COMMENT ON COLUMN public.reports.user_id IS 'FK to auth.users, set by server trigger';
COMMENT ON COLUMN public.reports.status IS 'aberto | confirmado | resolvido. Set by server only.';
COMMENT ON COLUMN public.reports.resolved_at IS 'Timestamp when status became resolvido. Set by server only.';
COMMENT ON COLUMN public.reports.points IS 'Base points for report (10). Set by server only.';
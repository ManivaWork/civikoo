-- 002: reports table with PostGIS location
-- ============================================================================

-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum for report status (real values from remote DB)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE public.report_status AS ENUM (
      'ativo', 'em_analise', 'em_andamento', 'resolvido', 'recusado'
    );
  END IF;
END $$;

-- reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location geography(Point, 4326) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  photo_url text,
  photo_thumbnail_url text,
  status public.report_status NOT NULL DEFAULT 'ativo',
  confirmations_continua int NOT NULL DEFAULT 0,
  confirmations_resolvido int NOT NULL DEFAULT 0,
  denials_count int NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- Denormalized for performance
  creator_username text,
  creator_avatar text,
  creator_level int
);

-- GIST index for spatial queries
CREATE INDEX IF NOT EXISTS reports_location_gist ON public.reports USING GIST (location);

-- Additional indexes
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_category_idx ON public.reports (category);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_hidden_idx ON public.reports (hidden) WHERE hidden = false;

-- Trigger to keep location in sync with lat/lng
CREATE OR REPLACE FUNCTION public.sync_report_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_report_location ON public.reports;
CREATE TRIGGER trigger_sync_report_location
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_report_location();

-- RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_visible" ON public.reports;
CREATE POLICY "reports_select_visible" ON public.reports
  FOR SELECT USING (hidden = false);

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_update_own" ON public.reports;
CREATE POLICY "reports_update_own" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.reports IS 'Reportes de problemas urbanos. user_id = profiles.id = auth.uid(). Status deriva de report_confirmations.';
-- 01: PostGIS + location column in reports
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography(Point,4326) location column to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Backfill existing rows: create point from latitude/longitude
UPDATE public.reports
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- GIST index for spatial queries (ST_DWithin, etc.)
CREATE INDEX IF NOT EXISTS idx_reports_location_gist
  ON public.reports USING GIST (location);

-- Trigger to keep location in sync on INSERT/UPDATE of latitude/longitude
CREATE OR REPLACE FUNCTION public.sync_report_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_report_location ON public.reports;
CREATE TRIGGER trg_sync_report_location
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_report_location();

COMMENT ON COLUMN public.reports.location IS 'Geography point (SRID 4326) for PostGIS spatial queries. Synced from latitude/longitude by trigger.';
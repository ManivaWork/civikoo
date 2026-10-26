-- 010: Anti-fraud / rate limits / spam protection
-- ============================================================================
-- Depends on: 001 (profiles), 002 (reports), 003 (report_confirmations)

-- Rate limit log table
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'report_create', 'confirm', 'flag', 'mission_claim', 'buy_item', 'equip_item'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_log_user_action_idx ON public.rate_limit_log (user_id, action, created_at);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_log_select_own" ON public.rate_limit_log;
CREATE POLICY "rate_limit_log_select_own" ON public.rate_limit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  alert_type text NOT NULL, -- 'gps_spoof', 'rapid_fire', 'impossible_distance', 'self_confirm_pattern', 'duplicate_reports'
  severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  details jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_alerts_user_idx ON public.fraud_alerts (user_id);
CREATE INDEX IF NOT EXISTS fraud_alerts_report_idx ON public.fraud_alerts (report_id);
CREATE INDEX IF NOT EXISTS fraud_alerts_type_idx ON public.fraud_alerts (alert_type);
CREATE INDEX IF NOT EXISTS fraud_alerts_reviewed_idx ON public.fraud_alerts (reviewed);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_alerts_select_own" ON public.fraud_alerts;
CREATE POLICY "fraud_alerts_select_own" ON public.fraud_alerts
  FOR SELECT USING (auth.uid() = user_id);

-- Admin can see all (via service role)
-- No policies for anon/authenticated insert/update - only service role

-- Function: check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_per_window int,
  p_window interval
)
RETURNS TABLE (allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count int;
  v_window_start timestamptz := now() - p_window;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= v_window_start;

  IF v_count >= p_max_per_window THEN
    RETURN QUERY SELECT false, 0, v_window_start + p_window;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action) VALUES (p_user_id, p_action);

  RETURN QUERY SELECT true, p_max_per_window - v_count - 1, v_window_start + p_window;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;

-- Function: flag potential fraud (called from confirm_report, report creation)
CREATE OR REPLACE FUNCTION public.flag_fraud(
  p_user_id uuid,
  p_alert_type text,
  p_severity text DEFAULT 'medium',
  p_details jsonb DEFAULT '{}'::jsonb,
  p_report_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.fraud_alerts (user_id, report_id, alert_type, severity, details)
  VALUES (p_user_id, p_report_id, p_alert_type, p_severity, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the main operation if fraud logging fails
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flag_fraud TO authenticated;

-- Function: detect GPS spoofing (impossible speed between consecutive reports/confirmations)
CREATE OR REPLACE FUNCTION public.detect_gps_spoof(p_user_id uuid, p_lat double precision, p_lng double precision, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_last_record RECORD;
  v_distance double precision;
  v_time_diff interval;
  v_speed_kmh double precision;
BEGIN
  -- Get last action location
  IF p_action = 'report_create' THEN
    SELECT latitude, longitude, created_at INTO v_last_record
    FROM public.reports
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF p_action = 'confirm' THEN
    SELECT user_lat, user_lng, created_at INTO v_last_record
    FROM public.report_confirmations
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_distance := ST_Distance(
    ST_SetSRID(ST_MakePoint(v_last_record.longitude, v_last_record.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  );

  v_time_diff := now() - v_last_record.created_at;
  v_speed_kmh := (v_distance / 1000) / (EXTRACT(EPOCH FROM v_time_diff) / 3600);

  -- Flag if speed > 120 km/h (impossible walking/driving in city)
  IF v_speed_kmh > 120 THEN
    PERFORM public.flag_fraud(p_user_id, NULL, 'gps_spoof', 'high', jsonb_build_object(
      'speed_kmh', round(v_speed_kmh),
      'distance_m', round(v_distance),
      'time_diff_sec', EXTRACT(EPOCH FROM v_time_diff),
      'action', p_action
    ));
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_gps_spoof TO authenticated;

-- Function: detect rapid fire (too many actions in short time)
CREATE OR REPLACE FUNCTION public.detect_rapid_fire(p_user_id uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= now() - interval '1 minute';

  IF v_count >= 5 THEN
    PERFORM public.flag_fraud(p_user_id, NULL, 'rapid_fire', 'medium', jsonb_build_object(
      'count_last_minute', v_count,
      'action', p_action
    ));
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_rapid_fire TO authenticated;

-- Function: detect duplicate reports (same user, same category, nearby, within 1 hour)
CREATE OR REPLACE FUNCTION public.detect_duplicate_reports(p_user_id uuid, p_category text, p_lat double precision, p_lng double precision)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.reports
    WHERE user_id = p_user_id
      AND category = p_category
      AND created_at >= now() - interval '1 hour'
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        100
      )
  ) INTO v_exists;

  IF v_exists THEN
    PERFORM public.flag_fraud(p_user_id, NULL, 'duplicate_reports', 'medium', jsonb_build_object(
      'category', p_category,
      'lat', p_lat,
      'lng', p_lng
    ));
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_duplicate_reports TO authenticated;

COMMENT ON TABLE public.rate_limit_log IS 'Log de ações para rate limiting.';
COMMENT ON TABLE public.fraud_alerts IS 'Alertas de fraude detectados automaticamente.';
COMMENT ON FUNCTION public.check_rate_limit IS 'Verifica e registra rate limit por ação/janela.';
COMMENT ON FUNCTION public.flag_fraud IS 'Registra alerta de fraude sem falhar a operação principal.';
COMMENT ON FUNCTION public.detect_gps_spoof IS 'Detecta velocidade impossível entre ações consecutivas.';
COMMENT ON FUNCTION public.detect_rapid_fire IS 'Detecta muitas ações do mesmo tipo em pouco tempo.';
COMMENT ON FUNCTION public.detect_duplicate_reports IS 'Detecta reportes duplicados do mesmo usuário.';
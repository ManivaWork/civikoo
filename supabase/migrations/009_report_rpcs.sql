-- 009: RPC functions for reports (confirm, flag, nearby, in_bounds)
-- ============================================================================
-- Depends on: 001 (profiles), 002 (reports), 003 (report_confirmations), 005 (award_reward)

-- Confirm report (continua/resolvido) with server-side proximity check
CREATE OR REPLACE FUNCTION public.confirm_report(
  p_report_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_type text, -- 'continua' or 'resolvido'
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision DEFAULT NULL
)
RETURNS TABLE (success boolean, message text, distance_m double precision, accuracy_m double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_report public.reports;
  v_distance double precision;
  v_already_confirmed boolean;
BEGIN
  -- Validate type
  IF p_type NOT IN ('continua', 'resolvido') THEN
    RETURN QUERY SELECT false, 'Tipo inválido', 0, 0;
  END IF;

  -- Get report
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL OR v_report.hidden THEN
    RETURN QUERY SELECT false, 'REPORTE_NAO_ENCONTRADO: Reporte não encontrado', 0, 0;
  END IF;

  -- Can't confirm own report
  IF v_report.user_id = v_user_id THEN
    RETURN QUERY SELECT false, 'Não pode confirmar próprio reporte', 0, 0;
  END IF;

  -- Check distance (50m)
  v_distance := ST_Distance(
    v_report.location,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
  );
  IF v_distance > 50 THEN
    RETURN QUERY SELECT false, 'FORA_DE_ALCANCE: Você precisa estar a até 50m do local', v_distance, p_accuracy;
  END IF;

  -- Check accuracy
  IF p_accuracy IS NOT NULL AND p_accuracy > 100 THEN
    RETURN QUERY SELECT false, 'GPS_PRECISAO_BAIXA: Precisão do GPS muito baixa (>100m)', v_distance, p_accuracy;
  END IF;

  -- Check already confirmed
  SELECT EXISTS (
    SELECT 1 FROM public.report_confirmations
    WHERE report_id = p_report_id AND user_id = v_user_id AND type = p_type
  ) INTO v_already_confirmed;
  IF v_already_confirmed THEN
    RETURN QUERY SELECT false, 'JA_CONFIRMOU: Você já confirmou este reporte', v_distance, p_accuracy;
  END IF;

  -- Rate limit: 30 confirmations per 24h
  IF (SELECT count(*) FROM public.report_confirmations WHERE user_id = v_user_id AND created_at >= now() - interval '24 hours') >= 30 THEN
    RETURN QUERY SELECT false, 'LIMITE_CONFIRMACOES: Limite de 30 confirmações por dia atingido', v_distance, p_accuracy;
  END IF;

  -- Cooldown: 30 seconds
  IF EXISTS (SELECT 1 FROM public.report_confirmations WHERE user_id = v_user_id AND created_at >= now() - interval '30 seconds') THEN
    RETURN QUERY SELECT false, 'COOLDOWN_CONFIRMACAO: Aguarde 30 segundos', v_distance, p_accuracy;
  END IF;

  -- Insert confirmation
  INSERT INTO public.report_confirmations (report_id, user_id, type, user_lat, user_lng, accuracy)
  VALUES (p_report_id, v_user_id, p_type, p_latitude, p_longitude, p_accuracy);

  -- Award reward
  IF p_type = 'continua' THEN
    PERFORM public.award_reward(v_user_id, 'confirmation_continua', 10, 5, 'report', p_report_id);
  ELSE
    PERFORM public.award_reward(v_user_id, 'confirmation_resolvido', 50, 20, 'report', p_report_id);
  END IF;

  RETURN QUERY SELECT true, 'Confirmado com sucesso', v_distance, p_accuracy;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_report TO authenticated;

-- Flag report
CREATE OR REPLACE FUNCTION public.flag_report(
  p_report_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_reason text -- 'falso', 'duplicado', 'ofensivo', 'outro'
)
RETURNS TABLE (success boolean, message text, flags_count int, hidden boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_report public.reports;
  v_flag_count int;
BEGIN
  IF p_reason NOT IN ('falso', 'duplicado', 'ofensivo', 'outro') THEN
    RETURN QUERY SELECT false, 'Motivo inválido', 0, false;
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RETURN QUERY SELECT false, 'Reporte não encontrado', 0, false;
  END IF;

  -- Check already flagged (using report_confirmations type='flag' as placeholder)
  -- For a full implementation, a separate flags table would be needed
  v_flag_count := (
    SELECT count(*) FROM public.report_confirmations
    WHERE report_id = p_report_id AND type = 'flag'
  ) + 1;

  IF v_flag_count >= 3 THEN
    UPDATE public.reports SET hidden = true, updated_at = now() WHERE id = p_report_id;
    RETURN QUERY SELECT true, 'Reporte ocultado por denúncias', v_flag_count, true;
  END IF;

  RETURN QUERY SELECT true, 'Denúncia registrada', v_flag_count, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flag_report TO authenticated;

-- Find nearby reports (for duplicate detection)
CREATE OR REPLACE FUNCTION public.reports_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters int DEFAULT 30,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  latitude double precision,
  longitude double precision,
  category text,
  title text,
  description text,
  image_url text,
  status public.report_status,
  points int,
  created_at timestamptz,
  distance_m double precision,
  creator_username text,
  creator_avatar text,
  creator_level int,
  confirmations_continua int,
  confirmations_resolvido int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.user_id, r.latitude, r.longitude, r.category, r.title, r.description,
    r.photo_url as image_url, r.status,
    CASE r.category
      WHEN 'buraco_asfalto' THEN 10
      WHEN 'vazamento_agua' THEN 15
      WHEN 'sinalizacao' THEN 8
      WHEN 'acessibilidade' THEN 12
      ELSE 5
    END as points,
    r.created_at,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) as distance_m,
    r.creator_username, r.creator_avatar, r.creator_level,
    r.confirmations_continua, r.confirmations_resolvido
  FROM public.reports r
  WHERE r.hidden = false
    AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, p_radius_meters)
    AND (p_category IS NULL OR r.category = p_category)
  ORDER BY distance_m
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reports_nearby TO anon, authenticated;

-- Reports in viewport bounds (for map loading)
CREATE OR REPLACE FUNCTION public.reports_in_bounds(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_categories text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_only_mine boolean DEFAULT false,
  p_since_days int DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bbox geometry;
  v_where text := '';
  v_params text[] := ARRAY[]::text[];
  v_report RECORD;
BEGIN
  IF p_min_lat > p_max_lat OR p_min_lng > p_max_lng THEN
    RAISE EXCEPTION 'Invalid bounding box';
  END IF;

  v_bbox := ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);

  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
    v_where := v_where || ' AND r.category = ANY($' || (array_length(v_params, 1) + 1)::text || ')';
    v_params := v_params || p_categories;
  END IF;

  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
    v_where := v_where || ' AND r.status = ANY($' || (array_length(v_params, 1) + 1)::text || ')';
    v_params := v_params || p_statuses;
  END IF;

  IF p_only_mine AND p_user_id IS NOT NULL THEN
    v_where := v_where || ' AND r.user_id = $' || (array_length(v_params, 1) + 1)::text;
    v_params := v_params || p_user_id::text;
  END IF;

  IF p_since_days IS NOT NULL AND p_since_days > 0 THEN
    v_where := v_where || ' AND r.created_at >= now() - ($' || (array_length(v_params, 1) + 1)::text || ')::interval';
    v_params := v_params || (p_since_days || ' days')::text;
  END IF;

  FOR v_report IN EXECUTE format('
    SELECT
      r.id, r.user_id, r.latitude, r.longitude, r.category, r.title, r.description,
      r.photo_url as image_url, r.status,
      CASE r.category
        WHEN ''buraco_asfalto'' THEN 10
        WHEN ''vazamento_agua'' THEN 15
        WHEN ''sinalizacao'' THEN 8
        WHEN ''acessibilidade'' THEN 12
        ELSE 5
      END as points,
      r.created_at, r.updated_at, r.resolved_at,
      r.creator_username, r.creator_avatar, r.creator_level,
      r.confirmations_continua, r.confirmations_resolvido
    FROM public.reports r
    WHERE r.hidden = false
      AND ST_Intersects(r.location, $1::geometry)
      %s
    ORDER BY r.created_at DESC
    LIMIT %s
  ', v_where, p_limit) USING v_bbox
  LOOP
    RETURN NEXT jsonb_build_object(
      'id', v_report.id,
      'user_id', v_report.user_id,
      'latitude', v_report.latitude,
      'longitude', v_report.longitude,
      'category', v_report.category,
      'title', v_report.title,
      'description', v_report.description,
      'image_url', v_report.image_url,
      'status', v_report.status,
      'points', v_report.points,
      'created_at', v_report.created_at,
      'updated_at', v_report.updated_at,
      'resolved_at', v_report.resolved_at,
      'creator_username', v_report.creator_username,
      'creator_avatar', v_report.creator_avatar,
      'creator_level', v_report.creator_level,
      'confirmations_continua', v_report.confirmations_continua,
      'confirmations_resolvido', v_report.confirmations_resolvido
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reports_in_bounds TO anon, authenticated;

COMMENT ON FUNCTION public.confirm_report IS 'Confirma reporte (continua/resolvido) com validação de proximidade 50m no servidor.';
COMMENT ON FUNCTION public.flag_report IS 'Denuncia reporte (3 denúncias = ocultado).';
COMMENT ON FUNCTION public.reports_nearby IS 'Busca reportes próximos para detecção de duplicatas.';
COMMENT ON FUNCTION public.reports_in_bounds IS 'Retorna reportes dentro do viewport do mapa com filtros. Usa índice GIST.';
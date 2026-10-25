-- 20: reports_in_bounds RPC for viewport-based loading
-- Uses GIST index on reports.location for efficient spatial queries
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reports_in_bounds(
    p_min_lat double precision,
    p_min_lng double precision,
    p_max_lat double precision,
    p_max_lng double precision,
    p_categories text[] DEFAULT NULL,
    p_statuses text[] DEFAULT NULL,
    p_user_id uuid DEFAULT NULL,
    p_only_mine boolean DEFAULT FALSE,
    p_since_days int DEFAULT NULL,
    p_limit int DEFAULT 500
)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bbox geometry;
    v_query text;
    v_where text := '';
    v_params text[] := ARRAY[]::text[];
    v_report RECORD;
    v_category_filter text := '';
    v_status_filter text := '';
    v_user_filter text := '';
    v_time_filter text := '';
    v_category_conditions text := '';
    v_status_conditions text := '';
BEGIN
    -- Validate bbox coordinates
    IF p_min_lat > p_max_lat OR p_min_lng > p_max_lng THEN
        RAISE EXCEPTION 'Invalid bounding box: min must be less than max';
    END IF;

    -- Build bounding box polygon
    v_bbox := ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);

    -- Category filter
    IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
        v_category_conditions := 'r.category = ANY($' || (array_length(v_params, 1) + 1)::text || ')';
        v_params := v_params || p_categories;
    END IF;

    -- Status filter
    IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
        v_status_conditions := 'r.status = ANY($' || (array_length(v_params, 1) + 1)::text || ')';
        v_params := v_params || p_statuses;
    END IF;

    -- User filter (my reports only)
    IF p_only_mine AND p_user_id IS NOT NULL THEN
        v_user_filter := 'r.user_id = $' || (array_length(v_params, 1) + 1)::text;
        v_params := v_params || p_user_id::text;
    END IF;

    -- Time filter (last N days)
    IF p_since_days IS NOT NULL AND p_since_days > 0 THEN
        v_time_filter := 'r.created_at >= now() - ($' || (array_length(v_params, 1) + 1)::text || ')::interval';
        v_params := v_params || (p_since_days || ' days')::text;
    END IF;

    -- Build WHERE clause combining all filters
    v_where := 'ST_DWithin(r.location::geography, ST_Centroid($1)::geography, ST_Distance(ST_MakePoint($2, $3)::geography, ST_MakePoint($4, $5)::geography))';
    -- Actually, simpler: use ST_Intersects with the bbox
    -- We'll use the bbox directly in the query

    -- Construct final query
    v_query := format('
        SELECT
            r.id,
            r.user_id,
            r.latitude,
            r.longitude,
            r.category,
            r.title,
            r.description,
            r.image_url,
            r.status,
            r.points,
            r.created_at,
            r.updated_at,
            r.resolved_at,
            u.username as creator_username,
            u.avatar_url as creator_avatar,
            u.level as creator_level,
            (
                SELECT COUNT(*) FROM public.report_confirmations rc
                WHERE rc.report_id = r.id AND rc.type = ''continua''
            ) as confirmations_continua,
            (
                SELECT COUNT(*) FROM public.report_confirmations rc
                WHERE rc.report_id = r.id AND rc.type = ''resolvido''
            ) as confirmations_resolvido
        FROM public.reports r
        JOIN auth.users u ON r.user_id = u.id
        WHERE r.hidden IS NOT TRUE
          AND ST_Intersects(r.location, $1::geometry)
          %s
          %s
          %s
          %s
        ORDER BY r.created_at DESC
        LIMIT %s
    ', v_category_conditions, v_status_conditions, v_user_filter, v_time_filter, p_limit);

    -- Execute query with parameters
    FOR v_report IN EXECUTE v_query USING v_bbox, p_min_lng, p_min_lat, p_max_lng, p_max_lat
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

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reports_in_bounds TO anon, authenticated;

COMMENT ON FUNCTION public.reports_in_bounds IS 'Retorna reportes dentro de um bounding box (viewport) com filtros opcionais. Usa índice GIST em reports.location. Limite padrão 500. Ignora reportes hidden.';
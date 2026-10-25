-- 004: triggers to update report status from confirmations
-- ============================================================================

-- Function to update report confirmation counts and status
CREATE OR REPLACE FUNCTION public.update_report_from_confirmations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_continua int;
  v_resolvido int;
BEGIN
  -- Count confirmations for this report
  SELECT count(*) FILTER (WHERE type = 'continua')
    INTO v_continua
    FROM public.report_confirmations
    WHERE report_id = NEW.report_id;

  SELECT count(*) FILTER (WHERE type = 'resolvido')
    INTO v_resolvido
    FROM public.report_confirmations
    WHERE report_id = NEW.report_id;

  -- Update report
  UPDATE public.reports
  SET confirmations_continua = v_continua,
      confirmations_resolvido = v_resolvido,
      status = CASE
        WHEN v_resolvido >= 2 THEN 'resolvido'::public.report_status
        WHEN v_continua >= 1 THEN 'em_analise'::public.report_status
        ELSE 'ativo'::public.report_status
      END,
      resolved_at = CASE
        WHEN v_resolvido >= 2 AND resolved_at IS NULL THEN now()
        ELSE resolved_at
      END,
      updated_at = now()
  WHERE id = NEW.report_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_report_confirmations ON public.report_confirmations;
CREATE TRIGGER trigger_update_report_confirmations
  AFTER INSERT ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_report_from_confirmations();

-- Also update on delete (if confirmation is removed)
CREATE OR REPLACE FUNCTION public.update_report_from_confirmations_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_continua int;
  v_resolvido int;
BEGIN
  SELECT count(*) FILTER (WHERE type = 'continua')
    INTO v_continua
    FROM public.report_confirmations
    WHERE report_id = OLD.report_id;

  SELECT count(*) FILTER (WHERE type = 'resolvido')
    INTO v_resolvido
    FROM public.report_confirmations
    WHERE report_id = OLD.report_id;

  UPDATE public.reports
  SET confirmations_continua = v_continua,
      confirmations_resolvido = v_resolvido,
      status = CASE
        WHEN v_resolvido >= 2 THEN 'resolvido'::public.report_status
        WHEN v_continua >= 1 THEN 'em_analise'::public.report_status
        ELSE 'ativo'::public.report_status
      END,
      updated_at = now()
  WHERE id = OLD.report_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_report_confirmations_delete ON public.report_confirmations;
CREATE TRIGGER trigger_update_report_confirmations_delete
  AFTER DELETE ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_report_from_confirmations_delete();

COMMENT ON FUNCTION public.update_report_from_confirmations IS 'Atualiza contadores e status do reporte baseado nas confirmações. Resolvido = 2+ confirmações "resolvido".';
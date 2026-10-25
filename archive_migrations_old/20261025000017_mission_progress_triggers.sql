-- 17: Mission Progress Triggers
-- ============================================================================
-- Função interna para incrementar progresso de missões
-- Chamada por triggers quando: reporte criado (não oculto), confirmação registrada
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_mission_progress(
    p_user_id uuid,
    p_action text, -- 'reporte', 'confirmacao', 'resolucao'
    p_category text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_daily_start date;
    v_weekly_start date;
    v_mission public.user_missions%rowtype;
    v_template public.mission_templates%rowtype;
BEGIN
    -- Calcula início dos períodos atuais
    v_daily_start := public.get_period_start('diaria');
    v_weekly_start := public.get_period_start('semanal');

    -- Para cada missão do usuário nos períodos atuais, verifica se a ação conta
    FOR v_mission IN
        SELECT um.*, mt.metric, mt.category, mt.target, mt.type
        FROM public.user_missions um
        JOIN public.mission_templates mt ON mt.id = um.template_id
        WHERE um.user_id = p_user_id
          AND um.period_start IN (v_daily_start, v_weekly_start)
          AND um.claimed_at IS NULL -- não incrementa missões já resgatadas
    LOOP
        v_template := v_mission;

        -- Verifica se a ação corresponde à métrica da missão
        CASE v_template.metric
            WHEN 'reportes' THEN
                IF p_action = 'reporte' THEN
                    -- Incrementa progresso
                    UPDATE public.user_missions
                    SET progress = LEAST(progress + 1, v_template.target),
                        completed_at = CASE
                            WHEN progress + 1 >= v_template.target AND completed_at IS NULL THEN now()
                            ELSE completed_at
                        END
                    WHERE id = v_mission.id;
                END IF;

            WHEN 'confirmacoes' THEN
                IF p_action = 'confirmacao' THEN
                    UPDATE public.user_missions
                    SET progress = LEAST(progress + 1, v_template.target),
                        completed_at = CASE
                            WHEN progress + 1 >= v_template.target AND completed_at IS NULL THEN now()
                            ELSE completed_at
                        END
                    WHERE id = v_mission.id;
                END IF;

            WHEN 'resolucoes' THEN
                IF p_action = 'resolucao' THEN
                    UPDATE public.user_missions
                    SET progress = LEAST(progress + 1, v_template.target),
                        completed_at = CASE
                            WHEN progress + 1 >= v_template.target AND completed_at IS NULL THEN now()
                            ELSE completed_at
                        END
                    WHERE id = v_mission.id;
                END IF;

            WHEN 'reportes_categoria' THEN
                IF p_action = 'reporte' AND p_category = v_template.category THEN
                    UPDATE public.user_missions
                    SET progress = LEAST(progress + 1, v_template.target),
                        completed_at = CASE
                            WHEN progress + 1 >= v_template.target AND completed_at IS NULL THEN now()
                            ELSE completed_at
                        END
                    WHERE id = v_mission.id;
                END IF;
        END CASE;
    END LOOP;

    RETURN;
END;
$$;

COMMENT ON FUNCTION public.update_mission_progress IS 'Incrementa progresso de missões ativas do usuário. p_action: reporte|confirmacao|resolucao. p_category para missões de categoria específica.';

-- ============================================================================
-- Trigger AFTER INSERT on reports: update mission progress (se não oculto)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_mission_progress_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Só incrementa se o reporte não está oculto (anti-fraude)
    IF NEW.hidden IS NOT TRUE THEN
        PERFORM public.update_mission_progress(NEW.user_id, 'reporte', NEW.category);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_progress_on_report ON public.reports;
CREATE TRIGGER trg_mission_progress_on_report
    AFTER INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_mission_progress_on_report();

-- ============================================================================
-- Trigger AFTER INSERT on report_confirmations: update mission progress
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_mission_progress_on_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.type = 'continua' THEN
        PERFORM public.update_mission_progress(NEW.user_id, 'confirmacao');
    ELSIF NEW.type = 'resolvido' THEN
        PERFORM public.update_mission_progress(NEW.user_id, 'resolucao');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_progress_on_confirmation ON public.report_confirmations;
CREATE TRIGGER trg_mission_progress_on_confirmation
    AFTER INSERT ON public.report_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_mission_progress_on_confirmation();

GRANT EXECUTE ON FUNCTION public.update_mission_progress TO authenticated;
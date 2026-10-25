-- 006: streak system (streak columns in profiles + milestones table)
-- ============================================================================
-- Depends on: 001 (profiles with streak columns), 005 (award_reward function)

-- Milestones table
CREATE TABLE IF NOT EXISTS public.user_streak_milestones (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_days int NOT NULL CHECK (milestone_days IN (3, 7, 14, 30)),
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_days)
);

-- Function to update streak (called by trigger on report creation/confirmation)
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_profile public.profiles;
  v_today date := now() AT TIME ZONE 'America/Sao_Paulo'::text;
  v_yesterday date := v_today - interval '1 day';
  v_new_streak int;
  v_milestone int;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_profile.last_active_date = v_today THEN
    RETURN; -- Already counted today
  ELSIF v_profile.last_active_date = v_yesterday THEN
    v_new_streak := v_profile.streak_count + 1;
  ELSE
    v_new_streak := 1; -- Streak broken
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET streak_count = v_new_streak,
      best_streak = GREATEST(best_streak, v_new_streak),
      last_active_date = v_today,
      updated_at = now()
  WHERE id = v_user_id;

  -- Check milestones (3, 7, 14, 30)
  FOR v_milestone IN SELECT unnest(ARRAY[3,7,14,30])
  LOOP
    IF v_new_streak >= v_milestone THEN
      INSERT INTO public.user_streak_milestones (user_id, milestone_days)
      VALUES (v_user_id, v_milestone)
      ON CONFLICT DO NOTHING;

      -- Award milestone reward
      PERFORM public.award_reward(v_user_id, 'streak_milestone', v_milestone * 10, v_milestone, 'streak', v_milestone::uuid);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_streak TO authenticated;

-- Trigger on report creation (user creates report -> streak)
CREATE OR REPLACE FUNCTION public.trigger_streak_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.update_streak(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_streak_on_report ON public.reports;
CREATE TRIGGER trigger_streak_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_on_report();

-- Trigger on confirmation (confirming also counts for streak)
CREATE OR REPLACE FUNCTION public.trigger_streak_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.update_streak(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_streak_on_confirmation ON public.report_confirmations;
CREATE TRIGGER trigger_streak_on_confirmation
  AFTER INSERT ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_on_confirmation();

COMMENT ON FUNCTION public.update_streak IS 'Atualiza streak do usuário usando fuso America/Sao_Paulo. Concede recompensas nos marcos 3, 7, 14, 30 dias.';
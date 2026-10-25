-- 04: reward_events ledger + triggers + level function

CREATE TABLE public.reward_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reporte','confirmacao','resolucao')),
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'pendente' CHECK (state IN ('pendente','liberado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reward_events_user_id ON public.reward_events (user_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_report_id ON public.reward_events (report_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_state ON public.reward_events (state);

-- Function: recalculate level from XP
-- level = floor(sqrt(xp / 50.0)) + 1
CREATE OR REPLACE FUNCTION public.recalculate_level(p_xp int)
RETURNS int LANGUAGE sql IMMUTABLE SECURITY DEFINER AS $$
  SELECT floor(sqrt(p_xp / 50.0))::int + 1;
$$;

-- Function: release a pending reward event -> add to profile, mark released
CREATE OR REPLACE FUNCTION public.release_reward(p_event_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event public.reward_events%rowtype;
BEGIN
  -- Lock the event row
  SELECT * INTO v_event
  FROM public.reward_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward event % not found', p_event_id;
  END IF;

  IF v_event.state = 'liberado' THEN
    RETURN; -- already released, idempotent
  END IF;

  -- Update profile atomically
  UPDATE public.profiles
  SET xp = xp + v_event.xp,
      coins = coins + v_event.coins,
      level = public.recalculate_level(xp + v_event.xp)
  WHERE id = v_event.user_id;

  -- Mark event as released
  UPDATE public.reward_events
  SET state = 'liberado', released_at = now()
  WHERE id = p_event_id;
END;
$$;

-- Trigger AFTER INSERT on reports: create pending reward for author
CREATE OR REPLACE FUNCTION public.create_reward_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
  VALUES (NEW.user_id, NEW.id, 'reporte', 10, 5, 'pendente');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_reward_on_report ON public.reports;
CREATE TRIGGER trg_create_reward_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.create_reward_on_report();

-- Function: confirm a report (called by confirmation RPC)
-- Creates pending confirmation reward for confirmer
CREATE OR REPLACE FUNCTION public.create_reward_on_confirmation(p_report_id uuid, p_confirmer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
  VALUES (p_confirmer_id, p_report_id, 'confirmacao', 5, 2, 'pendente');
END;
$$;

-- Function: resolve a report (called when 2 confirmations reached)
-- Creates pending resolution reward for original reporter
CREATE OR REPLACE FUNCTION public.create_reward_on_resolution(p_report_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_report public.reports%rowtype;
BEGIN
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.reward_events (user_id, report_id, type, xp, coins, state)
  VALUES (v_report.user_id, p_report_id, 'resolucao', 15, 10, 'pendente');

  -- Mark report as resolved
  UPDATE public.reports
  SET status = 'resolvido', resolved_at = now()
  WHERE id = p_report_id;
END;
$$;

COMMENT ON TABLE public.reward_events IS 'Ledger imutável de recompensas. State: pendente -> liberado (via release_reward).';
COMMENT ON COLUMN public.reward_events.type IS 'reporte (10 XP/5 coins) | confirmacao (5 XP/2 coins) | resolucao (15 XP/10 coins)';
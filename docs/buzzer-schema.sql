-- ============================================================================
-- CFM Live Games — Buzzer
--
-- Run this in the Supabase SQL editor, then paste the tables into
-- docs/db-schema.sql so that file stays the record of what exists.
--
-- Depends on docs/games-schema.sql.
--
-- THE WHOLE POINT OF THIS FILE IS THE CONSTRAINT ON `position`.
--
-- "Who buzzed first" cannot be decided by clients: 500 phones on mixed wifi and
-- mobile data have wildly different latency, and any client-supplied timestamp
-- is both unreliable and trivially forged. So the database decides. Position is
-- allocated inside a single statement (see buzzer_press below), and the
-- UNIQUE (prompt_id, position) constraint means two presses can never be
-- awarded the same place — under any amount of concurrency.
-- ============================================================================

-- ── Prompts: one question/challenge to buzz on ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.buzzer_prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  -- Absolute instant the host opened it; every press is measured from here so
  -- the recorded reaction time means the same thing for everyone.
  opened_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buzzer_prompts_round_order_idx
  ON public.buzzer_prompts (round_id, order_index);

-- ── Presses: the race result ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.buzzer_presses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id   uuid NOT NULL REFERENCES public.buzzer_prompts(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Server clock, never the client's.
  server_time timestamptz NOT NULL DEFAULT clock_timestamp(),
  position    integer NOT NULL,
  -- Milliseconds from the prompt opening to the press landing. Display only.
  reaction_ms integer,
  points_awarded integer NOT NULL DEFAULT 0,
  -- One press per person per prompt: hammering the button can't improve on
  -- your own first attempt.
  UNIQUE (prompt_id, profile_id),
  -- The fairness guarantee. Two simultaneous presses get 1 and 2, never 1 and 1.
  UNIQUE (prompt_id, position)
);

CREATE INDEX IF NOT EXISTS buzzer_presses_prompt_position_idx
  ON public.buzzer_presses (prompt_id, position);

ALTER TABLE public.buzzer_prompts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_presses  ENABLE ROW LEVEL SECURITY;

-- ── The atomic press ────────────────────────────────────────────────────────
-- Position is computed from the table inside the same INSERT, so there is no
-- read-then-write window for a competing press to slip through. A duplicate
-- press by the same person surfaces as unique_violation and is reported as
-- "you already buzzed" rather than being silently swallowed.
CREATE OR REPLACE FUNCTION public.buzzer_press(
  p_prompt_id  uuid,
  p_profile_id uuid
)
-- NOTE: the output columns are NOT called `position`. In a RETURNS TABLE clause
-- Postgres parses that name as the POSITION(substring IN string) function and
-- fails with a syntax error. It's legal as a *column* name, which is why the
-- table above is fine — but it has to be quoted wherever it's referenced here.
RETURNS TABLE (press_position integer, press_reaction_ms integer, press_already boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opened_at timestamptz;
  v_position  integer;
  v_reaction  integer;
BEGIN
  SELECT p.opened_at INTO v_opened_at
    FROM public.buzzer_prompts p
   WHERE p.id = p_prompt_id;

  IF v_opened_at IS NULL THEN
    RAISE EXCEPTION 'buzzer_closed';
  END IF;

  v_reaction := GREATEST(
    0,
    (EXTRACT(EPOCH FROM (clock_timestamp() - v_opened_at)) * 1000)::integer
  );

  BEGIN
    INSERT INTO public.buzzer_presses (prompt_id, profile_id, "position", reaction_ms)
    SELECT
      p_prompt_id,
      p_profile_id,
      COALESCE(MAX(x."position"), 0) + 1,
      v_reaction
    FROM public.buzzer_presses x
    WHERE x.prompt_id = p_prompt_id
    RETURNING "position" INTO v_position;

  EXCEPTION WHEN unique_violation THEN
    -- Either this person already buzzed, or another press took the position we
    -- computed. Report their existing press if they have one; otherwise let the
    -- caller retry the race.
    SELECT bp."position", bp.reaction_ms INTO v_position, v_reaction
      FROM public.buzzer_presses bp
     WHERE bp.prompt_id = p_prompt_id AND bp.profile_id = p_profile_id;

    IF v_position IS NULL THEN
      RAISE EXCEPTION 'position_taken';
    END IF;

    press_position    := v_position;
    press_reaction_ms := v_reaction;
    press_already     := true;
    RETURN NEXT;
    RETURN;
  END;

  press_position    := v_position;
  press_reaction_ms := v_reaction;
  press_already     := false;
  RETURN NEXT;
END;
$$;

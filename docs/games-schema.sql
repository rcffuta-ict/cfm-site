-- ============================================================================
-- CFM Live Games — schema
--
-- Run this once against the Supabase project (SQL editor), then paste the
-- table definitions into docs/db-schema.sql so that file stays the record of
-- what actually exists.
--
-- Design notes:
--   * One polymorphic `game_rounds` table serves trivia, buzzer and bingo, so
--     adding the other two games later needs no migration to the engine — only
--     their own answer tables.
--   * RLS is enabled with NO policies on every table. This app does not use
--     Supabase Auth (see src/lib/auth/session.ts — a self-signed HMAC cookie),
--     so `auth.uid()` policies would be dead code. Everything goes through
--     route handlers using the service-role client, which bypasses RLS; the
--     empty policy set is what denies the anon key any direct access.
-- ============================================================================

-- ── Sessions: one live programme (e.g. "CFM Hangout — July 2026") ───────────
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title            text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'live', 'ended')),
  current_round_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Only one live session per event, so /api/games/state never has to guess.
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_one_live_per_event
  ON public.game_sessions (event_id) WHERE status = 'live';

-- ── Rounds: every game type is a round inside a session ─────────────────────
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('trivia', 'buzzer', 'bingo')),
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'locked', 'revealed', 'ended')),
  order_index integer NOT NULL DEFAULT 0,
  -- Per-type settings, e.g. {"durationSeconds":20,"basePoints":100,"speedBonus":50}
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ABSOLUTE timestamps, never durations — every client derives its own
  -- countdown from ends_at so devices can't drift apart mid-round.
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_rounds_session_order_idx
  ON public.game_rounds (session_id, order_index);

ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_current_round_fkey;
ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_current_round_fkey
  FOREIGN KEY (current_round_id) REFERENCES public.game_rounds(id) ON DELETE SET NULL;

-- ── Participants: who joined this session ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, profile_id)
);

-- ── Trivia ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  question      text NOT NULL,
  options       jsonb NOT NULL,            -- ["A","B","C","D"]
  correct_index integer NOT NULL,
  points        integer NOT NULL DEFAULT 100,
  order_index   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS trivia_questions_round_order_idx
  ON public.trivia_questions (round_id, order_index);

CREATE TABLE IF NOT EXISTS public.trivia_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id       uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  choice_index   integer NOT NULL,
  answered_at    timestamptz NOT NULL DEFAULT now(),
  is_correct     boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 0,
  -- The database, not the client, enforces one answer per person per question.
  -- First write wins; the route relies on this rather than a read-then-write.
  UNIQUE (question_id, profile_id)
);

CREATE INDEX IF NOT EXISTS trivia_answers_round_idx
  ON public.trivia_answers (round_id);
CREATE INDEX IF NOT EXISTS trivia_answers_profile_idx
  ON public.trivia_answers (profile_id);

-- ── Lock everything down to the service role ────────────────────────────────
ALTER TABLE public.game_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_answers    ENABLE ROW LEVEL SECURITY;

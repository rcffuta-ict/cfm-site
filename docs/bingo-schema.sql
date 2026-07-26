-- ============================================================================
-- CFM Live Games — Bingo
--
-- Run this in the Supabase SQL editor, then paste the tables into
-- docs/db-schema.sql so that file stays the record of what exists.
--
-- Depends on docs/games-schema.sql (game_rounds, game_sessions, profiles).
--
-- The item pool lives in `game_rounds.config.items` — a jsonb array of strings
-- — rather than its own table, matching how trivia keeps its settings there.
-- A card's `layout` stores indexes into that pool, so renaming an item is a
-- one-place edit and every card follows.
-- ============================================================================

-- ── Calls: which items the host has announced, in order ─────────────────────
CREATE TABLE IF NOT EXISTS public.bingo_calls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  call_order integer NOT NULL,
  called_at  timestamptz NOT NULL DEFAULT now(),
  -- An item is called once. This is what stops a double-tap on the host's
  -- phone from advancing the game twice.
  UNIQUE (round_id, item_index),
  UNIQUE (round_id, call_order)
);

CREATE INDEX IF NOT EXISTS bingo_calls_round_order_idx
  ON public.bingo_calls (round_id, call_order);

-- ── Cards: one per person per round, generated once and kept ────────────────
CREATE TABLE IF NOT EXISTS public.bingo_cards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Array of pool indexes, row-major. `null` marks the free centre.
  layout     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Generated once and reused, so refreshing the phone never reshuffles the
  -- card someone has been marking all evening.
  UNIQUE (round_id, profile_id)
);

-- ── Marks: the cells a player has tapped ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bingo_marks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL REFERENCES public.bingo_cards(id) ON DELETE CASCADE,
  cell_index integer NOT NULL,
  marked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, cell_index)
);

CREATE INDEX IF NOT EXISTS bingo_marks_card_idx
  ON public.bingo_marks (card_id);

-- ── Wins: validated claims, in the order they landed ────────────────────────
CREATE TABLE IF NOT EXISTS public.bingo_wins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Which line they completed, e.g. "row-2", "col-0", "diag-down", "full".
  pattern    text NOT NULL,
  position   integer NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  -- One win per person per round; the position ordering decides first place.
  UNIQUE (round_id, profile_id),
  UNIQUE (round_id, position)
);

CREATE INDEX IF NOT EXISTS bingo_wins_round_idx
  ON public.bingo_wins (round_id, position);

-- ── Deny-all to the anon key; everything goes through route handlers ────────
ALTER TABLE public.bingo_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_wins  ENABLE ROW LEVEL SECURITY;

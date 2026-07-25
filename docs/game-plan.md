# CFM Live Games — Integration Plan
**Trivia + Buzzer + Bingo, on top of your existing Supabase + Next.js CFM app**

---

## 1. Core Concept: One Game Engine, Three Games

Instead of building trivia, buzzer, and bingo as three separate features, build one small
**game engine** that all three plug into. This is what makes the experience feel cohesive
instead of like three different apps stitched together — same host controls, same TV
transitions, same phone navigation pattern, same leaderboard.

The engine has two channels of communication:

- **Control plane** — "what's happening right now" (start round, lock, reveal, next).
  Broadcast-based, instant, cheap, ephemeral.
- **Data plane** — the actual game data (answers, buzzer presses, bingo marks).
  Written to Postgres, persisted, used for scoring.

Keeping these separate is the single biggest thing that will make this scale cleanly to 500+
people without surprises on the night.

---

## 2. Data Model (Supabase/Postgres)

```sql
-- one row per live event (e.g. "CFM Hangout — July 2026")
sessions (id, title, status, current_round_id, created_at)

-- polymorphic round table — every game type is a "round" inside a session
game_rounds (
  id, session_id, type,        -- 'trivia' | 'buzzer' | 'bingo'
  status,                       -- 'pending' | 'active' | 'locked' | 'revealed' | 'ended'
  order_index, config jsonb,    -- per-type settings (time limit, points, etc.)
  starts_at, ends_at            -- ABSOLUTE timestamps, not durations (see §6)
)

participants (id, user_id, session_id, team_id, joined_at)
teams (id, session_id, name)   -- e.g. seed from existing 100L–500L levels

-- Trivia
trivia_questions (id, round_id, question, options jsonb, correct_index, points)
trivia_answers (round_id, user_id, choice_index, answered_at, is_correct, points_awarded)
  UNIQUE (round_id, user_id)

-- Buzzer
buzzer_prompts (id, round_id, prompt_text)
buzzer_presses (round_id, user_id, server_time, position)
  -- position assigned atomically server-side, see §5

-- Bingo
bingo_cards (id, user_id, session_id, card_layout jsonb, generated_at)
bingo_marks (card_id, cell_index, marked_at)

-- Combined scoring across all three games
scores (session_id, user_id, trivia_points, buzzer_points, bingo_points, total_points)
```

**RLS notes:** users can only insert their *own* row in `trivia_answers` / `buzzer_presses` /
`bingo_marks`, only while the parent round's `status = 'active'`. Never trust the client for
scoring — validate correctness and round status server-side (RPC or Edge Function), not in the
phone app.

---

## 3. Real-Time Strategy — the part that actually matters at your scale

Supabase Realtime has a concurrent connection cap: **200 on Free, 500 on Pro ($25/mo)**. With
500+ members, you do *not* want every phone holding a live socket open — you'd be right at the
ceiling before accounting for the TV computer and host panel.

**Recommendation: phones don't hold realtime connections at all.**

- Phones **poll** a lightweight "what's the current round + status" endpoint every 2–3 seconds.
  This feels realtime to a human but costs nothing in connection quota — it's just cheap HTTP
  requests, and Supabase (or an Edge Function) can serve it from an indexed single-row lookup.
- Phones **submit** answers/presses/marks via a normal POST/RPC call — again, no persistent
  connection needed.
- **Only your TV computer** (and optionally the host control panel) holds real Supabase Realtime
  subscriptions — one connection, subscribed to the control-plane broadcast channel and to
  `buzzer_presses` inserts during buzzer rounds. That's 1–2 connections total, regardless of how
  many people show up.

This means you can comfortably run the whole event on the **Free tier** from a connections
standpoint — though I'd still budget the $25 Pro tier for the event so a paused project or a
storage/bandwidth ceiling never becomes a surprise mid-program.

---

## 4. Host Control Panel

A single `/host` route, gated by an `is_host` flag on the profile (reuse your existing auth —
no new login system needed). Buttons:

`Start Round → Lock Answers → Reveal → Next Round` (for trivia)
`Open Buzzer → Reset Buzzer` (for buzzer)
`Announce Bingo Winner` (for bingo, since bingo mostly runs itself)

Every button press emits one message on the session's control broadcast channel. That single
message is what both the TV and (via polling) the phones react to.

---

## 5. Buzzer — the one game that needs real care

"First to answer" with 500 people is a race condition, not a UX problem — client-side timing
will always be unfair because of network latency variance. Solve it server-side:

1. Host opens the buzzer (`buzzer_prompts` row goes active).
2. Every phone that taps "Buzz" fires one RPC call — no realtime needed on the phone side.
3. The RPC does an atomic insert into `buzzer_presses` with a **unique constraint on
   `round_id`** (single-winner mode) or an auto-incrementing `position` computed inside the same
   transaction (top-3 mode). The database — not any client — decides who was first.
4. The TV (which *is* subscribed to this table) shows the winner the instant the row lands.

This gives you a provably fair result even with imperfect wifi in the room.

---

## 6. TV Experience

- Runs full-screen/kiosk mode from the local church-wifi computer.
- Holds the one realtime subscription for the whole venue (see §3) — TVs don't each need their
  own connection if they're all rendered from the same local server/browser instance.
- **Sync timers with absolute timestamps, not durations.** Broadcast `ends_at` as an epoch
  timestamp, and have every client (TV and phone) compute `remaining = ends_at - now()`
  locally. If you broadcast "you have 15 seconds" instead, devices that receive the message
  late will drift out of sync with each other — small thing, but it's the difference between
  feeling "live" and feeling glitchy with 500 people watching one screen.
- Give each game its own branded full-screen state: Question / Locked / Reveal+Leaderboard for
  trivia; "Buzzer open" / Winner reveal for buzzer; live bingo-winner announcements as toast-style
  overlays that don't interrupt whatever else is on screen.
- Use consistent transitions (Framer Motion works well in Next.js) between states so the whole
  night feels like one produced show, not separate demos.

---

## 7. Phone Experience

- The phone UI should **auto-switch** to whatever game is currently active (driven by the
  polling loop against session state), so people don't have to hunt for a tab. Show a
  "Waiting for next round…" idle state otherwise.
- **Optimistic UI**: the instant someone taps an answer or the buzzer, show immediate visual
  confirmation ("Answer locked in ✅" / "Buzzed!") *before* the network call resolves, then
  reconcile silently. On patchy Nigerian mobile data this single detail does more for perceived
  quality than almost anything else — nobody should be left wondering if their tap registered.
- Retry gracefully on failed submissions — a clear "Couldn't submit, tap to retry" beats a
  silent failure every time.
- Buzzer button: add haptic feedback (Vibration API) and a satisfying press animation — cheap to
  build, disproportionately fun in the room.
- Bingo: card generated once per user per session (store the shuffled layout in
  `bingo_cards.card_layout` so refreshes don't reshuffle it), self-marked, with server-side
  validation when someone claims "BINGO!"

---

## 8. Unified Scoring & Leaderboard

One combined leaderboard across all three games (trivia correctness/speed points + buzzer win
bonuses + bingo completion bonus) shown as the big finale on the TV. Nice extra: feed the
top scorers into your **existing raffle system** as bonus entries — ties the new games back
into what the app already does well, and gives people a reason to care about the leaderboard
beyond bragging rights.

---

## 9. Build Order & Rehearsal Checklist

1. **Foundation** — sessions/rounds tables, control-plane broadcast plumbing, host panel shell.
2. **Trivia** — simplest, ship and test with a small group first.
3. **Bingo** — low real-time complexity, can build in parallel with trivia.
4. **Buzzer** — build last; needs the atomic RPC and the most testing.
5. **Leaderboard + TV polish + transitions.**
6. **Load test before the day**: write a small script that fires ~500 concurrent answer
   submissions and ~50 concurrent buzzer presses at a test session, and confirm the unique
   constraints/RPC hold up under real concurrency — don't discover a race condition live in
   front of the fellowship.
7. **Full dry run** with the actual TVs and host walking the real script end-to-end.

---
---

# OpenGraph Image Brief

**Canvas:** 1200 × 630 px (standard 1.91:1 OG ratio) · PNG · sRGB · aim for **under ~300 KB** so
link previews load instantly on WhatsApp (where most of your members will actually see this
shared).

**Safe zone:** keep all essential content (logos, title, tagline) inside a centered
**1000 × 520 px** area, with at least ~60–100 px breathing room on every edge. Different
platforms (WhatsApp, X, Facebook, LinkedIn) crop the outer edges differently — nothing important
should live right at the border.

### Layout (mirrors the hero-logo-top / credit-logo-bottom pattern your login page already uses,
so the OG image feels like part of the same product)

```
┌──────────────────────────────────────────────────────┐
│  [RCFFUTA logo, small, top-left]                     │  ← ~72–96px height
│                                                        │
│              [ CFM ICON — large, centered ]           │  ← hero mark, ~180–220px
│                                                        │
│            COMBINED FAMILY MEETING                    │  ← CFM wordmark/logo, bold
│              Hangout • Games Night                    │  ← tagline, lighter weight
│                                                        │
│  ─────────────────────────────────────────────────    │  ← thin divider
│   Powered by RCF FUTA ICT Team     [ICT Team logo]    │  ← small, ~48–60px height
└──────────────────────────────────────────────────────┘
```

### Visual hierarchy (avoid "logo soup")

With four logos in play, hierarchy is what keeps this from looking cluttered:

1. **Hero (largest, full color):** CFM Icon — it's the actual identity of this event, so it
   earns the visual center of gravity.
2. **Primary text lockup:** CFM Logo/wordmark — "Combined Family Meeting" — directly under or
   beside the icon, bold, high contrast.
3. **Supporting (small, top corner):** RCFFUTA Logo — establishes parent organization without
   competing with the hero.
4. **Credit line (smallest, bottom, muted):** ICT Team Logo, paired with the same "Powered by RCF
   FUTA ICT Team" text your site's footer already uses — tint it to a single muted tone (white or
   greyscale at ~80% opacity) rather than full color, so it reads as a credit, not a competing
   logo.

### Typography & color

- Match whatever font/color tokens your live Next.js app already uses (pull exact hex values
  from your Tailwind config/CSS variables) — that consistency is what makes the shared link feel
  like "the CFM app" rather than a generic flyer.
- Event title: bold display weight, ~64–80px equivalent.
- Tagline: lighter weight, ~28–32px.
- If any logo is dark-colored, give it a soft light panel/rounded card behind it rather than
  placing it directly on a dark background — protects contrast without you needing a second
  logo variant.

### Bonus (since you're already in Next.js)

If you want this to update automatically per event (e.g., different tagline each program) rather
than being one static file, `@vercel/og` (Satori) lets you generate the OG image on the fly from
an API route using JSX + CSS — worth it if CFM runs regularly and you don't want to re-export a
PNG by hand every time.

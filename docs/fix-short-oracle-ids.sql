-- ============================================================================
-- CFM — renumber Oracle IDs that came out too short
--
-- Run 1 and 2 first. Read what they return. Only then run 3.
--
-- ROOT CAUSE FIRST
--   Oracle IDs are `RAFFLE_ID_BASE + 0..99`. A 4-digit ID means that variable is
--   set to a 4-digit number wherever the app is actually running. Vercel uses
--   the values in its own project settings, NOT the .env.production file in the
--   repo — check there and set it to a 5-digit base (e.g. 42700) before running
--   this, or new short IDs will keep appearing behind you.
--
-- WHAT THIS AFFECTS — read before running
--   * People's Oracle ID CHANGES. Anyone who wrote theirs down, or read it off
--     their dashboard, now has the wrong number. They need to reopen the
--     dashboard to see the new one.
--   * Anyone who has ALREADY joined the game stays joined — membership is keyed
--     on the person, not the number. But someone who hasn't joined yet and tries
--     the old number will be turned away.
--   * Because of that, prefer to run this BEFORE the draw starts. Mid-programme,
--     it is safer to leave short IDs alone: they still work, they're just short.
--   * Afterwards press "Refresh members" on the Oracle console, or the draw will
--     keep using the old numbers from its local snapshot.
-- ============================================================================

-- ── 1. PREVIEW — who has a short ID ─────────────────────────────────────────
SELECT
  r.raffle_id,
  r.first_name || ' ' || r.last_name AS name,
  r.email
FROM public.event_registrations r
JOIN public.events e ON e.id = r.event_id
WHERE e.slug = 'cfm-rcffuta'
  AND r.raffle_id IS NOT NULL
  AND r.raffle_id < 10000
ORDER BY r.raffle_id;

-- ── 2. CHECK — is the target band roomy enough? ─────────────────────────────
-- Adjust 42700/42999 if you want a different band; keep it 5 digits.
SELECT
  count(*) FILTER (WHERE r.raffle_id BETWEEN 42700 AND 42999) AS band_in_use,
  300 - count(*) FILTER (WHERE r.raffle_id BETWEEN 42700 AND 42999) AS band_free,
  count(*) FILTER (WHERE r.raffle_id < 10000) AS need_renumbering
FROM public.event_registrations r
JOIN public.events e ON e.id = r.event_id
WHERE e.slug = 'cfm-rcffuta';

-- ── 3. RENUMBER — only after the preview looks right ────────────────────────
-- Each short ID takes the next free number in the band, oldest registration
-- first, so the assignment is deterministic rather than random.
WITH needs AS (
  SELECT r.id, row_number() OVER (ORDER BY r.created_at, r.id) AS n
  FROM public.event_registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.slug = 'cfm-rcffuta'
    AND r.raffle_id IS NOT NULL
    AND r.raffle_id < 10000
),
free AS (
  SELECT g AS candidate, row_number() OVER (ORDER BY g) AS n
  FROM generate_series(42700, 42999) AS g
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.event_registrations r2
    JOIN public.events e2 ON e2.id = r2.event_id
    WHERE e2.slug = 'cfm-rcffuta'
      AND r2.raffle_id = g
  )
)
UPDATE public.event_registrations r
   SET raffle_id = free.candidate
  FROM needs
  JOIN free ON free.n = needs.n
 WHERE r.id = needs.id;

-- ── 4. CONFIRM — should return zero rows ────────────────────────────────────
SELECT count(*) AS still_short
FROM public.event_registrations r
JOIN public.events e ON e.id = r.event_id
WHERE e.slug = 'cfm-rcffuta'
  AND r.raffle_id IS NOT NULL
  AND r.raffle_id < 10000;

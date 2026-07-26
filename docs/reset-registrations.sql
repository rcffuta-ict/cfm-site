-- ============================================================================
-- CFM — keep only today's registrations
--
-- Run the SELECT first. Read what it returns. Only then run the DELETE.
--
-- "Today" is measured in Africa/Lagos, not UTC — otherwise anything registered
-- before 01:00 local would be counted as yesterday.
--
-- WHAT THIS AFFECTS
--   * Deleted people lose their Oracle ID and stop appearing in the draw and in
--     the live stats. If they are in the hall, they simply sign in again and are
--     issued a new one — nothing is broken for them.
--   * Game scores are NOT touched. Trivia answers, bingo cards and buzzer
--     presses are keyed on the profile, not the registration.
--   * The Oracle laptop keeps its own snapshot. After running this, press
--     **Refresh members** on /admin or the draw will still offer deleted people.
-- ============================================================================

-- ── 1. PREVIEW — what would go ──────────────────────────────────────────────
SELECT
  r.raffle_id,
  r.first_name || ' ' || r.last_name AS name,
  r.email,
  r.created_at AT TIME ZONE 'Africa/Lagos' AS registered_lagos
FROM public.event_registrations r
JOIN public.events e ON e.id = r.event_id
WHERE e.slug = 'cfm-rcffuta'
  AND (r.created_at AT TIME ZONE 'Africa/Lagos')::date
      < (now() AT TIME ZONE 'Africa/Lagos')::date
ORDER BY r.created_at;

-- ── 2. COUNT — a sanity check before and after ──────────────────────────────
SELECT
  count(*) FILTER (
    WHERE (r.created_at AT TIME ZONE 'Africa/Lagos')::date
        = (now() AT TIME ZONE 'Africa/Lagos')::date
  ) AS from_today,
  count(*) FILTER (
    WHERE (r.created_at AT TIME ZONE 'Africa/Lagos')::date
        < (now() AT TIME ZONE 'Africa/Lagos')::date
  ) AS older,
  count(*) AS total
FROM public.event_registrations r
JOIN public.events e ON e.id = r.event_id
WHERE e.slug = 'cfm-rcffuta';

-- ── 3. DELETE — only after the preview looks right ──────────────────────────
-- Scoped to this event by slug, so it can never reach another event's rows.
DELETE FROM public.event_registrations r
USING public.events e
WHERE r.event_id = e.id
  AND e.slug = 'cfm-rcffuta'
  AND (r.created_at AT TIME ZONE 'Africa/Lagos')::date
      < (now() AT TIME ZONE 'Africa/Lagos')::date;

-- ── AFTERWARDS ──────────────────────────────────────────────────────────────
-- Press "Refresh members" on the Oracle console, and "Clear waiting room" if
-- any of the deleted people were drawn during rehearsal.

-- ============================================================================
-- CFM — let a registration have no phone number
--
-- NOT URGENT. Run this after the event, not during it.
--
-- `event_registrations.phone_number` is NOT NULL and also part of the
-- UNIQUE (event_id, phone_number) constraint `unique_event_phone`. Together
-- those make a member with no phone on file impossible to register twice over:
-- the first gets `''`, and every one after collides.
--
-- The app currently works around this by writing `no-phone:<profile-id>`, which
-- is unique by construction. This migration removes the need for that: Postgres
-- allows any number of NULLs in a unique index, so a genuinely absent phone
-- becomes NULL and the constraint stops applying to it.
--
-- After running this, change the fallback in src/app/(auth)/login/actions.ts
-- from the placeholder back to `null`.
-- ============================================================================

ALTER TABLE public.event_registrations
  ALTER COLUMN phone_number DROP NOT NULL;

-- Convert the placeholders and blanks already written.
UPDATE public.event_registrations
   SET phone_number = NULL
 WHERE phone_number IS NULL
    OR btrim(phone_number) = ''
    OR phone_number LIKE 'no-phone:%';

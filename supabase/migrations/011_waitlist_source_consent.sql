-- Migration 011: waitlist_emails — source and consent_given columns
--
-- SAFE TO APPLY: both columns use NOT NULL with a DEFAULT, so Postgres
-- backfills all existing rows atomically without a separate UPDATE pass.
-- No data is lost; no existing insert breaks — the INSERT in waitlist.js
-- currently omits both fields, which will continue to work: new rows written
-- before the backend is deployed will receive the column defaults
-- ('landing' and false). The backend is updated in the same deploy to write
-- explicit values, so the window of default-only inserts is one deploy cycle.
--
-- source        — distinguishes landing-page signups from in-app invest-interest
--                 captures. Values: 'landing' | 'in_app_invest'
--                 Default 'landing' backfills all rows created by the landing page.
--
-- consent_given — DPDP consent flag. Records that the user explicitly ticked the
--                 consent checkbox at point of submission. Default false backfills
--                 existing rows conservatively (pre-consent-UI signups are not
--                 retroactively consented). The UI enforces checkbox-before-submit;
--                 the backend validates consent_given = true before inserting.

ALTER TABLE waitlist_emails
  ADD COLUMN IF NOT EXISTS source        text    NOT NULL DEFAULT 'landing',
  ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;

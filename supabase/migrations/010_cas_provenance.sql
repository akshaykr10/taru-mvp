-- Migration 010: CAS provenance + schema formalization
--
-- 1. Add source column to cas_funds so holdings can be distinguished by origin.
--    'cas_import'   — imported via CASParser (SDK widget or PDF upload); all existing rows.
--    'taru_invested' — reserved for the future BSE StAR MF investment flow (separate brief).
--    The column has a server-side DEFAULT so the NAV update job (updateNavs.js) and any
--    upsert that omits the field will never accidentally reset it.
--
-- 2. Formally define nav_history and waitlist_emails — both tables were created
--    directly in Supabase and are in active use. This migration documents their
--    schema and adds RLS. IF NOT EXISTS makes this safe to run against production.

-- ── 1. cas_funds: provenance ──────────────────────────────────
ALTER TABLE cas_funds
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'cas_import';

-- Backfill explicit for absolute clarity; ALTER … DEFAULT already fills existing rows
-- but this makes the intent plain in the migration log.
UPDATE cas_funds SET source = 'cas_import' WHERE source IS NULL;

-- ── 2. nav_history ────────────────────────────────────────────
-- Daily NAV snapshots written by the AMFI update job (backend/src/jobs/updateNavs.js).
-- One row per (user, isin, folio, date). Re-running the job on the same day is a no-op
-- due to the unique constraint (insert with count:'exact' logs the error and continues).
CREATE TABLE IF NOT EXISTS nav_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isin         text        NOT NULL,
  folio_number text        NOT NULL DEFAULT '',
  nav          numeric     NOT NULL,
  nav_date     date        NOT NULL,
  UNIQUE (user_id, isin, folio_number, nav_date)
);

CREATE INDEX IF NOT EXISTS nav_history_user_date_idx
  ON nav_history (user_id, nav_date DESC);

ALTER TABLE nav_history ENABLE ROW LEVEL SECURITY;

-- No authenticated client reads nav_history today — all writes are via the service
-- role (GitHub Actions NAV update job) and the table is not queried by any frontend
-- or API route. The SELECT policy is forward-looking posture: RLS is enabled so the
-- table is locked down by default, and this policy is the right permission to grant
-- when a NAV history chart is added. It protects nothing currently in use.
CREATE POLICY IF NOT EXISTS "parent reads own nav history"
  ON nav_history FOR SELECT
  USING (auth.uid() = user_id);

-- ── 3. waitlist_emails ────────────────────────────────────────
-- Public email capture from the landing page (POST /api/waitlist).
-- A source column (Phase 3) and consent_given flag will be added in migration 011
-- when the in-app invest interest capture surface is built.
CREATE TABLE IF NOT EXISTS waitlist_emails (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE waitlist_emails ENABLE ROW LEVEL SECURITY;

-- No client-side SELECT needed — writes are via service role only.
-- The founder queries this table directly via the Supabase dashboard.

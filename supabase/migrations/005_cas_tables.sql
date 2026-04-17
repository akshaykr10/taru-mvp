-- Migration 005: CASParser production tables
-- Replaces the old portfolio_snapshots + fund_tags approach with
-- a richer schema that stores per-fund data and tracks fetch quota.

-- ── Rate-limit log ────────────────────────────────────────────
-- One row per fetch attempt. Only status='success' rows count toward
-- the 14-day rolling quota enforced in POST /api/cas/token.
CREATE TABLE IF NOT EXISTS cas_fetch_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  method     text NOT NULL CHECK (method IN ('sdk', 'pdf')),
  status     text NOT NULL CHECK (status IN ('success', 'failed'))
);

-- ── Portfolio snapshots ───────────────────────────────────────
-- Full raw CASParser response per fetch. Used for NAV-change trigger
-- comparisons against the previous snapshot's data.
CREATE TABLE IF NOT EXISTS cas_portfolio (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  cas_type   text,
  raw_json   jsonb NOT NULL
);

-- ── Per-fund rows ─────────────────────────────────────────────
-- One row per (user, isin, folio) — updated in place on every import.
-- show_in_child_app is preserved across imports (never reset by upsert).
-- portfolio_id always points to the latest import for that fund.
CREATE TABLE IF NOT EXISTS cas_funds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     uuid REFERENCES cas_portfolio(id) ON DELETE SET NULL,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folio_number     text NOT NULL DEFAULT '',
  amc              text,
  fund_name        text NOT NULL,
  isin             text NOT NULL,
  scheme_type      text,           -- 'Equity' | 'Debt' | 'Hybrid' | 'Other'
  units            numeric,
  nav              numeric,
  current_value    numeric,
  cost             numeric,
  gain_absolute    numeric,
  gain_percentage  numeric,
  show_in_child_app boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, isin, folio_number)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cas_fetch_log_user_fetched_idx
  ON cas_fetch_log (user_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS cas_portfolio_user_fetched_idx
  ON cas_portfolio (user_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS cas_funds_user_idx
  ON cas_funds (user_id);

CREATE INDEX IF NOT EXISTS cas_funds_type_name_idx
  ON cas_funds (scheme_type, fund_name);

-- ── Row Level Security ────────────────────────────────────────
-- Backend uses service role (bypasses RLS). These policies cover
-- direct client-side reads from Dashboard.jsx (anon key + session).

ALTER TABLE cas_fetch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cas_portfolio  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cas_funds      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent reads own fetch log"
  ON cas_fetch_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "parent reads own portfolio"
  ON cas_portfolio FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "parent reads own funds"
  ON cas_funds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "parent updates own funds"
  ON cas_funds FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- Taru MVP — Add created_at to task_rules
-- The initial schema omitted created_at on task_rules, but the
-- backend orders and selects by it. This migration adds the column
-- with a server-side default so existing rows are backfilled and
-- all future inserts are timestamped automatically.
-- Run this AFTER 002_auth_trigger.sql.
-- ============================================================

ALTER TABLE task_rules
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

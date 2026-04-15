-- ============================================================
-- Taru MVP — Learning Module Schema Extension
-- Extends learning_state and conversation_log to support the
-- weekly curriculum flow. Safe to re-run (all guards in place).
-- Run this AFTER 003_task_rules_created_at.sql.
-- ============================================================

-- ── learning_state additions ──────────────────────────────────

-- When the child started the current week (used to detect stale/incomplete weeks)
ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS current_week_started_at timestamptz DEFAULT NULL;

-- When the child completed the current week's content card
ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS week_completed_at timestamptz DEFAULT NULL;

-- When the dinner-table prompt was last surfaced to the child for the current week
ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS dinner_prompted_at timestamptz DEFAULT NULL;

-- ── conversation_log additions ────────────────────────────────

-- Links the prompt to a specific child, enabling per-child progress tracking.
-- Nullable so existing rows (created before this migration) remain valid.
ALTER TABLE conversation_log
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id) ON DELETE CASCADE DEFAULT NULL;

-- ── Indexes ───────────────────────────────────────────────────

-- Supports looking up whether a specific child has a prompt for a given week
CREATE INDEX IF NOT EXISTS idx_conversation_log_child_week
  ON conversation_log(child_id, week_number);

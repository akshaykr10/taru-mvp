-- Migration 008: Add unique constraint on conversation_log(parent_id, week_number)
-- Required for the upsert in /api/child/week-complete to resolve conflicts
-- correctly instead of inserting duplicate rows.

ALTER TABLE conversation_log
  ADD CONSTRAINT uq_conversation_parent_week UNIQUE (parent_id, week_number);

-- Migration 006: Tighten conversation_log RLS to verify child ownership
-- The existing policy only checks parent_id = auth.uid(), allowing a parent
-- to write a row referencing another parent's child_id. This replacement
-- policy adds a child_id ownership guard to the WITH CHECK clause.

DROP POLICY IF EXISTS "conversation_log: parent manages own" ON conversation_log;

CREATE POLICY "conversation_log: parent manages own"
  ON conversation_log
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (
    parent_id = auth.uid()
    AND (
      child_id IS NULL
      OR child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
    )
  );

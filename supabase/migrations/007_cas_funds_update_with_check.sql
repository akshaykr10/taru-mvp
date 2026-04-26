-- Migration 007: Add explicit WITH CHECK to cas_funds UPDATE policy
-- PostgreSQL implicitly reuses USING as WITH CHECK when absent, but
-- making it explicit removes reliance on that default behaviour.

DROP POLICY IF EXISTS "parent updates own funds" ON cas_funds;

CREATE POLICY "parent updates own funds"
  ON cas_funds FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Taru MVP — coin_transactions table
-- Tracks all coin earn/redeem events per child
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id   uuid NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  type        text NOT NULL,          -- 'task_complete' | 'redeem_invest' | 'redeem_cash' | 'redeem_invest_done' | 'redeem_cash_done'
  coins       integer NOT NULL,       -- positive = earned, negative = redeemed
  label       text NOT NULL,
  emoji       text,
  status      text DEFAULT 'completed', -- 'pending' | 'completed'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_transactions_child_id_idx
  ON coin_transactions (child_id, created_at DESC);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Parents can read transactions for their own children
CREATE POLICY "coin_transactions: parent reads own"
  ON coin_transactions FOR SELECT
  USING (parent_id = auth.uid());

-- Service role (backend) handles all writes — no RLS needed for INSERT/UPDATE

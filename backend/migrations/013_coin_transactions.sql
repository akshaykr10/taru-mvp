-- Migration 013: coin_transactions table
-- Tracks all coin earn/redeem events per child.
-- Writes are service-role only; parents read their own rows via RLS.

CREATE TABLE coin_transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid        NOT NULL REFERENCES children(id)  ON DELETE CASCADE,
  parent_id   uuid        NOT NULL REFERENCES parents(id)   ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN (
                            'task_approved',
                            'redeem_invest',
                            'redeem_cash',
                            'redeem_invest_done',
                            'redeem_cash_done'
                          )),
  coins       integer     NOT NULL,  -- positive = earned, negative = redeemed
  label       text        NOT NULL,
  emoji       text        NOT NULL DEFAULT '🪙',
  status      text        NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Parents may read their own rows only
CREATE POLICY "parents_select_own_coin_transactions"
  ON coin_transactions
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- All writes go through the service role key (backend only).
-- No INSERT / UPDATE / DELETE policies for the authenticated role.

-- Indexes
CREATE INDEX idx_coin_transactions_child_created
  ON coin_transactions (child_id, created_at DESC);

CREATE INDEX idx_coin_transactions_parent_pending
  ON coin_transactions (parent_id, status)
  WHERE status = 'pending';

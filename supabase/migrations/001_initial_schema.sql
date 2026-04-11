-- ============================================================
-- Taru MVP — Initial Schema Migration
-- Run this in the Supabase SQL editor or via Supabase CLI
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS children (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name        text NOT NULL,
  dob         date NOT NULL,
  age_stage   text NOT NULL CHECK (age_stage IN ('seed', 'sprout', 'growth', 'investor')),
  goal_name   text,
  goal_amount numeric,
  goal_date   date,
  child_token text UNIQUE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  fetched_at       timestamptz DEFAULT now(),
  cas_type         text CHECK (cas_type IN ('casparser_widget', 'pdf_upload')),
  raw_json         jsonb NOT NULL,
  statement_period text
);

CREATE TABLE IF NOT EXISTS fund_tags (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id            uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  isin                 text NOT NULL,
  fund_name            text NOT NULL,
  fund_type            text CHECK (fund_type IN ('Equity', 'Debt', 'Hybrid', 'Other')),
  is_visible_to_child  boolean DEFAULT false,
  UNIQUE (parent_id, isin)
);

CREATE TABLE IF NOT EXISTS task_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  task_name    text NOT NULL,
  reward_coins integer NOT NULL,
  frequency    text NOT NULL CHECK (frequency IN ('one-time', 'weekly', 'custom')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused'))
);

CREATE TABLE IF NOT EXISTS task_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_rule_id   uuid NOT NULL REFERENCES task_rules(id) ON DELETE CASCADE,
  completed_at   timestamptz DEFAULT now(),
  approved_at    timestamptz,
  rejected_at    timestamptz
  -- status is derived: both null = pending, approved_at set = approved, rejected_at set = rejected
);

CREATE TABLE IF NOT EXISTS learning_state (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
  current_week      integer DEFAULT 1,
  last_trigger_type text,
  coins_total       integer DEFAULT 0,
  xp_total          integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversation_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id      uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  week_number    integer NOT NULL,
  prompt_text    text NOT NULL,
  marked_done_at timestamptz
);

CREATE TABLE IF NOT EXISTS activity_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type  text NOT NULL CHECK (actor_type IN ('parent', 'child')),
  parent_id   uuid REFERENCES parents(id) ON DELETE CASCADE,
  child_id    uuid REFERENCES children(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  section     text,
  occurred_at timestamptz DEFAULT now(),  -- ALWAYS server-set, never client
  metadata    jsonb
);

-- ── Indexes ───────────────────────────────────────────────────

-- Speed up per-parent lookups
CREATE INDEX IF NOT EXISTS idx_children_parent_id            ON children (parent_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_parent_id ON portfolio_snapshots (parent_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_fetched   ON portfolio_snapshots (parent_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_tags_parent_id           ON fund_tags (parent_id);
CREATE INDEX IF NOT EXISTS idx_task_rules_parent_id          ON task_rules (parent_id);
CREATE INDEX IF NOT EXISTS idx_task_rules_child_id           ON task_rules (child_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_rule_id      ON task_completions (task_rule_id);
CREATE INDEX IF NOT EXISTS idx_conversation_log_parent_id    ON conversation_log (parent_id);

-- Activity events: founder runs weekly queries by occurred_at
CREATE INDEX IF NOT EXISTS idx_activity_events_parent_id    ON activity_events (parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_occurred_at  ON activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type   ON activity_events (event_type);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE parents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE children            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events     ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: parents ─────────────────────────────────────

CREATE POLICY "parents: own row only"
  ON parents
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── RLS Policies: children ────────────────────────────────────

CREATE POLICY "children: parent sees own children"
  ON children
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── RLS Policies: portfolio_snapshots ────────────────────────

CREATE POLICY "portfolio_snapshots: parent sees own"
  ON portfolio_snapshots
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── RLS Policies: fund_tags ───────────────────────────────────

CREATE POLICY "fund_tags: parent manages own"
  ON fund_tags
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── RLS Policies: task_rules ──────────────────────────────────

CREATE POLICY "task_rules: parent manages own"
  ON task_rules
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── RLS Policies: task_completions ───────────────────────────
-- Completions are accessed via the backend (service role) for child writes.
-- Authenticated parents see completions for their own task_rules only.

CREATE POLICY "task_completions: parent sees own rules' completions"
  ON task_completions
  FOR SELECT
  TO authenticated
  USING (
    task_rule_id IN (
      SELECT id FROM task_rules WHERE parent_id = auth.uid()
    )
  );

-- Parents can approve/reject (UPDATE) completions on their rules
CREATE POLICY "task_completions: parent updates own rules' completions"
  ON task_completions
  FOR UPDATE
  TO authenticated
  USING (
    task_rule_id IN (
      SELECT id FROM task_rules WHERE parent_id = auth.uid()
    )
  );

-- ── RLS Policies: learning_state ─────────────────────────────
-- Written only by backend (service role). Parents can read their child's state.

CREATE POLICY "learning_state: parent reads own child's state"
  ON learning_state
  FOR SELECT
  TO authenticated
  USING (
    child_id IN (
      SELECT id FROM children WHERE parent_id = auth.uid()
    )
  );

-- ── RLS Policies: conversation_log ───────────────────────────

CREATE POLICY "conversation_log: parent manages own"
  ON conversation_log
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── RLS Policies: activity_events ────────────────────────────
-- Read-only for authenticated parents (they can see their own events).
-- Writes happen exclusively via backend with service role key.
-- Founder uses service role key to query all rows.

CREATE POLICY "activity_events: parent reads own events"
  ON activity_events
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for authenticated role on activity_events.
-- All writes go through the backend service role.

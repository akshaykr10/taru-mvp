-- Migration 014: calculator_leads
-- Stores one row per lead captured from the milestone savings calculator.
-- Writes are via service role only (Express backend). No client-side access.

CREATE TABLE IF NOT EXISTS calculator_leads (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                     text        NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  child_age                 int         NOT NULL,
  goal_key                  text        NOT NULL,
  goal_detail               jsonb,
  target_age                int,
  years_to_goal             int,
  today_cost                numeric,
  target_corpus             numeric,
  existing_savings_by_asset jsonb,
  monthly_sip               numeric,
  step_up_enabled           boolean     NOT NULL DEFAULT false,
  step_up_pct               numeric,
  on_track_corpus           numeric,
  gap                       numeric,
  required_additional_sip   numeric,
  funding_pct               numeric,
  source                    text        NOT NULL DEFAULT 'calculator',
  consent_given             boolean     NOT NULL DEFAULT false,
  utm_source                text,
  utm_medium                text,
  utm_campaign              text
);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_email
  ON calculator_leads (email);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_created_at
  ON calculator_leads (created_at DESC);

ALTER TABLE calculator_leads ENABLE ROW LEVEL SECURITY;
-- No INSERT/SELECT policy: backend writes via service role, founder reads via dashboard

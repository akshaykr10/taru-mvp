-- 012_consent_log_create.sql
-- Creates consent_log if it does not already exist.
-- Migration 009 was written but not applied to production.
-- This migration is idempotent and safe to run on any environment.

create table if not exists consent_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  eula_version text not null,
  accepted_at  timestamptz not null,
  unique(user_id, eula_version)
);

alter table consent_log enable row level security;

-- Backend writes use the service role key and bypass RLS entirely.
-- No client-side SELECT policy is needed; consent status is checked
-- via GET /api/consent/status (authenticated, service role on backend).

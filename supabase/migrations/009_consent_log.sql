-- consent_log: records when a user accepted a specific EULA version
create table if not exists consent_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  eula_version text not null,
  accepted_at  timestamptz not null,
  unique(user_id, eula_version)
);

-- Enable RLS
alter table consent_log enable row level security;

-- Parents may read their own consent record (for the gate check via service role only)
-- The gate check is done server-side via service role key, so no client SELECT policy needed.
-- We allow INSERT via service role (backend); no direct client writes.

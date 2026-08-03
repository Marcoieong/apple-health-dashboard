create table if not exists shortcut_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists shortcut_credentials_owner_active_idx
  on shortcut_credentials(owner_id, created_at desc)
  where revoked_at is null;

alter table shortcut_credentials enable row level security;
alter table shortcut_credentials force row level security;

drop policy if exists shortcut_credentials_owner_policy
  on shortcut_credentials;
create policy shortcut_credentials_owner_policy on shortcut_credentials
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

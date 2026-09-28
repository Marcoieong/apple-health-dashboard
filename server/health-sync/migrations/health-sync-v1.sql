create table if not exists health_daily_metrics (
  owner_id text not null,
  local_date date not null,
  timezone text not null,
  steps integer check (steps between 0 and 300000),
  active_energy_kcal double precision check (active_energy_kcal between 0 and 30000),
  exercise_minutes double precision check (exercise_minutes between 0 and 1440),
  sleep_hours double precision check (sleep_hours between 0 and 24),
  weight_kg double precision check (weight_kg > 0 and weight_kg <= 1000),
  body_fat_percent double precision check (body_fat_percent between 0 and 100),
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, local_date)
);

create index if not exists health_daily_metrics_owner_date_idx
  on health_daily_metrics(owner_id, local_date desc);

create table if not exists health_sync_credentials (
  id uuid primary key,
  owner_id text not null,
  device_installation_id text not null
    check (device_installation_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique (owner_id, id)
);

create index if not exists health_sync_credentials_owner_idx
  on health_sync_credentials(owner_id, created_at desc)
  where revoked_at is null;

create table if not exists health_sync_devices (
  owner_id text not null,
  device_installation_id text not null
    check (device_installation_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  last_cursor text,
  last_collected_at timestamptz,
  last_sync_id uuid,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, device_installation_id)
);

create table if not exists health_sync_requests (
  owner_id text not null,
  sync_id uuid not null,
  device_installation_id text not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('processing', 'recorded', 'failed')),
  accepted_days integer not null default 0 check (accepted_days between 0 and 31),
  changed_days integer not null default 0 check (changed_days between 0 and 31),
  response_snapshot jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, sync_id)
);

alter table health_daily_metrics enable row level security;
alter table health_sync_credentials enable row level security;
alter table health_sync_devices enable row level security;
alter table health_sync_requests enable row level security;

alter table health_daily_metrics force row level security;
alter table health_sync_credentials force row level security;
alter table health_sync_devices force row level security;
alter table health_sync_requests force row level security;

drop policy if exists health_daily_metrics_owner_policy on health_daily_metrics;
create policy health_daily_metrics_owner_policy on health_daily_metrics
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

drop policy if exists health_sync_credentials_owner_policy on health_sync_credentials;
create policy health_sync_credentials_owner_policy on health_sync_credentials
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

drop policy if exists health_sync_devices_owner_policy on health_sync_devices;
create policy health_sync_devices_owner_policy on health_sync_devices
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

drop policy if exists health_sync_requests_owner_policy on health_sync_requests;
create policy health_sync_requests_owner_policy on health_sync_requests
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

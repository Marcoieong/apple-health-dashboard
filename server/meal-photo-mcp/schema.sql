-- PostgreSQL reference schema for the private meal-photo service.
-- This file is a reviewed contract only; it is not run by the public Vite app.

create extension if not exists pgcrypto;

create table meal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  local_date date not null,
  timezone text not null,
  meal_type text not null
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_labels jsonb not null default '[]'::jsonb
    check (jsonb_typeof(food_labels) = 'array'),
  preparation_methods jsonb not null default '[]'::jsonb
    check (jsonb_typeof(preparation_methods) = 'array'),
  notes text,
  source text not null default 'chatgpt'
    check (source in ('chatgpt', 'shortcut')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_entries_owner_date_idx
  on meal_entries (owner_id, local_date desc, created_at desc);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  content_sha256 text not null
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  detected_mime text not null
    check (detected_mime in ('image/jpeg', 'image/png', 'image/webp')),
  source_bytes bigint not null check (source_bytes > 0),
  master_width integer not null check (master_width > 0),
  master_height integer not null check (master_height > 0),
  thumbnail_width integer not null check (thumbnail_width > 0),
  thumbnail_height integer not null check (thumbnail_height > 0),
  sanitized_master_object_key text not null,
  thumbnail_object_key text not null,
  sanitized_at timestamptz not null,
  raw_original_purged_at timestamptz not null,
  master_delete_after timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, content_sha256),
  unique (sanitized_master_object_key),
  unique (thumbnail_object_key)
);

create table meal_photos (
  meal_entry_id uuid not null references meal_entries(id) on delete cascade,
  media_asset_id uuid not null references media_assets(id) on delete restrict,
  ordinal smallint not null check (ordinal between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (meal_entry_id, ordinal),
  unique (meal_entry_id, media_asset_id)
);

create table ingest_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  idempotency_key_hash text not null,
  request_digest text not null
    check (request_digest ~ '^[0-9a-f]{64}$'),
  status text not null
    check (status in ('processing', 'recorded', 'failed')),
  meal_entry_id uuid references meal_entries(id) on delete set null,
  response_snapshot jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key_hash)
);

create table ingest_request_files (
  ingest_request_id uuid not null
    references ingest_requests(id) on delete cascade,
  ordinal smallint not null check (ordinal between 0 and 3),
  source_file_ref_hmac text not null,
  media_asset_id uuid references media_assets(id) on delete set null,
  primary key (ingest_request_id, ordinal)
);

create table shortcut_credentials (
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

-- The application sets app.owner_id after validating the OAuth subject.
-- Database roles used by the public Vite deployment must not have table access.
alter table meal_entries enable row level security;
alter table media_assets enable row level security;
alter table meal_photos enable row level security;
alter table ingest_requests enable row level security;
alter table ingest_request_files enable row level security;
alter table shortcut_credentials enable row level security;

alter table meal_entries force row level security;
alter table media_assets force row level security;
alter table meal_photos force row level security;
alter table ingest_requests force row level security;
alter table ingest_request_files force row level security;
alter table shortcut_credentials force row level security;

create policy meal_entries_owner_policy on meal_entries
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

create policy media_assets_owner_policy on media_assets
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

create policy meal_photos_owner_policy on meal_photos
  using (
    exists (
      select 1
      from meal_entries
      where meal_entries.id = meal_photos.meal_entry_id
        and meal_entries.owner_id = current_setting('app.owner_id', true)
    )
    and exists (
      select 1
      from media_assets
      where media_assets.id = meal_photos.media_asset_id
        and media_assets.owner_id = current_setting('app.owner_id', true)
    )
  )
  with check (
    exists (
      select 1
      from meal_entries
      where meal_entries.id = meal_photos.meal_entry_id
        and meal_entries.owner_id = current_setting('app.owner_id', true)
    )
    and exists (
      select 1
      from media_assets
      where media_assets.id = meal_photos.media_asset_id
        and media_assets.owner_id = current_setting('app.owner_id', true)
    )
  );

create policy ingest_requests_owner_policy on ingest_requests
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

create policy ingest_request_files_owner_policy on ingest_request_files
  using (
    exists (
      select 1
      from ingest_requests
      where ingest_requests.id = ingest_request_files.ingest_request_id
        and ingest_requests.owner_id = current_setting('app.owner_id', true)
    )
    and (
      ingest_request_files.media_asset_id is null
      or exists (
        select 1
        from media_assets
        where media_assets.id = ingest_request_files.media_asset_id
          and media_assets.owner_id = current_setting('app.owner_id', true)
      )
    )
  )
  with check (
    exists (
      select 1
      from ingest_requests
      where ingest_requests.id = ingest_request_files.ingest_request_id
        and ingest_requests.owner_id = current_setting('app.owner_id', true)
    )
    and (
      ingest_request_files.media_asset_id is null
      or exists (
        select 1
        from media_assets
        where media_assets.id = ingest_request_files.media_asset_id
          and media_assets.owner_id = current_setting('app.owner_id', true)
      )
    )
  );

create policy shortcut_credentials_owner_policy on shortcut_credentials
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

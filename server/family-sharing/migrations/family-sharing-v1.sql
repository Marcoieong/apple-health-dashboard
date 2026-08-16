create extension if not exists pgcrypto;

create table if not exists family_households (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 80),
  created_by_owner_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family_household_members (
  household_id uuid not null references family_households(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  owner_id text not null unique,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, owner_id)
);

create table if not exists family_household_invitations (
  id uuid primary key,
  household_id uuid not null references family_households(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by_owner_id text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists family_invitation_lookup_idx
  on family_household_invitations (household_id, email, expires_at);

create table if not exists family_sharing_grants (
  household_id uuid not null references family_households(id) on delete cascade,
  subject_owner_id text not null,
  viewer_owner_id text not null,
  scope text not null check (
    scope in ('score', 'activity_status', 'sleep_status', 'weekly_direction', 'advice')
  ),
  created_at timestamptz not null default now(),
  primary key (household_id, subject_owner_id, viewer_owner_id, scope),
  foreign key (household_id, subject_owner_id)
    references family_household_members(household_id, owner_id) on delete cascade,
  foreign key (household_id, viewer_owner_id)
    references family_household_members(household_id, owner_id) on delete cascade,
  check (subject_owner_id <> viewer_owner_id)
);

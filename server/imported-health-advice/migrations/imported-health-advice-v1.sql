create extension if not exists pgcrypto;

create table if not exists imported_health_advice (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  source text not null default 'chatgpt_health_manual'
    check (source = 'chatgpt_health_manual'),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists imported_health_advice_owner_created_idx
  on imported_health_advice (owner_id, created_at desc);

alter table imported_health_advice enable row level security;
alter table imported_health_advice force row level security;

drop policy if exists imported_health_advice_owner_isolation
  on imported_health_advice;

create policy imported_health_advice_owner_isolation
  on imported_health_advice
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

alter table imported_health_advice
  add column if not exists external_id text;

alter table imported_health_advice
  add column if not exists captured_at timestamptz;

alter table imported_health_advice
  drop constraint if exists imported_health_advice_source_check;

alter table imported_health_advice
  add constraint imported_health_advice_source_check
  check (source in ('chatgpt_health_manual', 'chatgpt_health_shortcut'));

create unique index if not exists imported_health_advice_external_id_idx
  on imported_health_advice (owner_id, source, external_id)
  where external_id is not null;

alter table imported_health_advice enable row level security;
alter table imported_health_advice force row level security;

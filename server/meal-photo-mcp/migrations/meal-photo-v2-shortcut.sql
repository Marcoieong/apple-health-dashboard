alter table meal_entries
  drop constraint if exists meal_entries_source_check;

alter table meal_entries
  add constraint meal_entries_source_check
  check (source in ('chatgpt', 'shortcut'));

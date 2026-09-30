import { neon } from '@neondatabase/serverless';
import {
  importedHealthAdviceSource,
  importedHealthAdviceSources,
  shortcutImportedHealthAdviceSource,
  type ImportedHealthAdviceSource,
  type ImportedHealthAdviceItem
} from './contracts.js';
import type { ImportedHealthAdviceConfig } from './config.js';

type Row = Record<string, unknown>;

function stringValue(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected database value.');
  return value;
}

function optionalDateValue(value: unknown): string | undefined {
  return typeof value === 'string'
    ? new Date(value).toISOString()
    : undefined;
}

function sourceValue(value: unknown): ImportedHealthAdviceSource {
  if (
    typeof value === 'string' &&
    importedHealthAdviceSources.includes(value as ImportedHealthAdviceSource)
  ) {
    return value as ImportedHealthAdviceSource;
  }
  throw new Error('Unexpected database value.');
}

function toItem(row: Row): ImportedHealthAdviceItem {
  return {
    id: stringValue(row.id),
    source: sourceValue(row.source),
    content: stringValue(row.content),
    capturedAt: optionalDateValue(row.captured_at),
    createdAt: new Date(stringValue(row.created_at)).toISOString()
  };
}

export async function listImportedHealthAdvice(
  ownerId: string,
  config: ImportedHealthAdviceConfig,
  limit = 20
): Promise<ImportedHealthAdviceItem[]> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select id::text, source, content, captured_at::text, created_at::text
       from imported_health_advice
       where owner_id = $1
       order by created_at desc
       limit $2`,
      [ownerId, Math.min(Math.max(Math.trunc(limit), 1), 50)]
    )
  ]);
  return (results[1] as Row[]).map(toItem);
}

export async function createImportedHealthAdvice(
  ownerId: string,
  content: string,
  config: ImportedHealthAdviceConfig
): Promise<ImportedHealthAdviceItem> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `insert into imported_health_advice (owner_id, source, content)
       values ($1, $2, $3)
       returning id::text, source, content, captured_at::text, created_at::text`,
      [ownerId, importedHealthAdviceSource, content]
    )
  ]);
  const row = (results[1] as Row[])[0];
  if (!row) throw new Error('Unexpected database result.');
  return toItem(row);
}

export interface ShortcutImportedHealthAdviceInput {
  content: string;
  requestId: string;
  capturedAt?: string;
}

export interface CreateShortcutImportedHealthAdviceResult {
  item: ImportedHealthAdviceItem;
  created: boolean;
}

export async function createShortcutImportedHealthAdvice(
  ownerId: string,
  input: ShortcutImportedHealthAdviceInput,
  config: ImportedHealthAdviceConfig
): Promise<CreateShortcutImportedHealthAdviceResult> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `with inserted as (
         insert into imported_health_advice (
           owner_id, source, external_id, content, captured_at
         )
         values ($1, $2, $3, $4, $5::timestamptz)
         on conflict (owner_id, source, external_id)
           where external_id is not null
         do nothing
         returning id::text, source, content, captured_at::text,
                   created_at::text, true as created
       )
       select * from inserted
       union all
       select id::text, source, content, captured_at::text,
              created_at::text, false as created
       from imported_health_advice
       where owner_id = $1 and source = $2 and external_id = $3
         and not exists (select 1 from inserted)
       limit 1`,
      [
        ownerId,
        shortcutImportedHealthAdviceSource,
        input.requestId,
        input.content,
        input.capturedAt ?? null
      ]
    )
  ]);
  const row = (results[1] as Row[])[0];
  if (!row || typeof row.created !== 'boolean') {
    throw new Error('Unexpected database result.');
  }
  return { item: toItem(row), created: row.created };
}

export async function deleteImportedHealthAdvice(
  ownerId: string,
  id: string,
  config: ImportedHealthAdviceConfig
): Promise<boolean> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `delete from imported_health_advice
       where owner_id = $1 and id = $2::uuid
       returning id`,
      [ownerId, id]
    )
  ]);
  return (results[1] as Row[]).length === 1;
}

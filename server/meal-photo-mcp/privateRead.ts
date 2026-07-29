import { createHmac } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { MealSource, MealType } from './contracts.js';
import type { PrivateMealStorageConfig } from './runtimeConfig.js';

type Row = Record<string, unknown>;

export interface PrivateMealListItem {
  id: string;
  localDate: string;
  timezone: string;
  mealType: MealType;
  foodLabels: string[];
  preparationMethods: string[];
  notes?: string;
  source: MealSource;
  photoCount: number;
  recordedAt: string;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected database value.');
  return value;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  throw new Error('Unexpected database array.');
}

function opaqueId(
  secret: string,
  ownerId: string,
  databaseId: string
): string {
  return createHmac('sha256', secret)
    .update(['private-read-id', ownerId, databaseId].join('\0'))
    .digest('base64url')
    .slice(0, 24);
}

export function mapPrivateMealListItem(
  row: Row,
  ownerId: string,
  secret: string
): PrivateMealListItem {
  const notes = typeof row.notes === 'string' ? row.notes : undefined;
  return {
    id: opaqueId(secret, ownerId, asString(row.id)),
    localDate: asString(row.local_date).slice(0, 10),
    timezone: asString(row.timezone),
    mealType: asString(row.meal_type) as MealType,
    foodLabels: asStringArray(row.food_labels),
    preparationMethods: asStringArray(row.preparation_methods),
    ...(notes ? { notes } : {}),
    source: asString(row.source) as MealSource,
    photoCount: Number(row.photo_count),
    recordedAt: new Date(asString(row.created_at)).toISOString()
  };
}

export async function listPrivateMeals(
  ownerId: string,
  config: PrivateMealStorageConfig,
  limit = 60
): Promise<PrivateMealListItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select
         me.id::text as id,
         me.local_date::text as local_date,
         me.timezone,
         me.meal_type,
         me.food_labels,
         me.preparation_methods,
         me.notes,
         me.source,
         me.created_at::text as created_at,
         count(mp.media_asset_id)::int as photo_count
       from meal_entries me
       left join meal_photos mp on mp.meal_entry_id = me.id
       where me.owner_id = $1
       group by me.id
       order by me.local_date desc, me.created_at desc
       limit $2`,
      [ownerId, safeLimit]
    )
  ]);

  return (results[1] as Row[]).map((row) =>
    mapPrivateMealListItem(row, ownerId, config.ingestHmacSecret)
  );
}

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
  thumbnail?: {
    assetId: string;
    width: number;
    height: number;
  };
  recordedAt: string;
}

export interface PrivateThumbnailAsset {
  objectKey: string;
  mimeType: string;
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
  const thumbnailAssetId =
    typeof row.thumbnail_asset_id === 'string'
      ? row.thumbnail_asset_id
      : undefined;
  const thumbnailWidth = Number(row.thumbnail_width);
  const thumbnailHeight = Number(row.thumbnail_height);
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
    ...(thumbnailAssetId &&
    Number.isFinite(thumbnailWidth) &&
    thumbnailWidth > 0 &&
    Number.isFinite(thumbnailHeight) &&
    thumbnailHeight > 0
      ? {
          thumbnail: {
            assetId: thumbnailAssetId,
            width: thumbnailWidth,
            height: thumbnailHeight
          }
        }
      : {}),
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
         count(mp.media_asset_id)::int as photo_count,
         thumbnail.asset_id as thumbnail_asset_id,
         thumbnail.thumbnail_width,
         thumbnail.thumbnail_height
       from meal_entries me
       left join meal_photos mp on mp.meal_entry_id = me.id
       left join lateral (
         select
           ma.id::text as asset_id,
           ma.thumbnail_width,
           ma.thumbnail_height
         from meal_photos first_photo
         join media_assets ma on ma.id = first_photo.media_asset_id
         where first_photo.meal_entry_id = me.id
         order by first_photo.ordinal asc
         limit 1
       ) thumbnail on true
       where me.owner_id = $1
       group by
         me.id,
         thumbnail.asset_id,
         thumbnail.thumbnail_width,
         thumbnail.thumbnail_height
       order by me.local_date desc, me.created_at desc
       limit $2`,
      [ownerId, safeLimit]
    )
  ]);

  return (results[1] as Row[]).map((row) =>
    mapPrivateMealListItem(row, ownerId, config.ingestHmacSecret)
  );
}

export async function getPrivateThumbnailAsset(
  ownerId: string,
  assetId: string,
  config: PrivateMealStorageConfig
): Promise<PrivateThumbnailAsset | undefined> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      assetId
    )
  ) {
    return undefined;
  }

  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select thumbnail_object_key, detected_mime
       from media_assets
       where owner_id = $1 and id = $2
       limit 1`,
      [ownerId, assetId]
    )
  ]);
  const row = (results[1] as Row[])[0];
  if (!row) return undefined;
  return {
    objectKey: asString(row.thumbnail_object_key),
    mimeType: asString(row.detected_mime)
  };
}

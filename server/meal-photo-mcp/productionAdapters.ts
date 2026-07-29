import { createHmac, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { del, put } from '@vercel/blob';
import sharp, { type Sharp } from 'sharp';
import type {
  DownloadedPhoto,
  MediaAssetRepository,
  MealRepository,
  PhotoDownloader,
  PhotoSanitizer,
  PrivateMealRecord,
  PrivateMediaStore,
  RecordMealDependencies,
  SanitizedPhoto,
  StoredMediaAsset,
  SupportedImageType
} from './contracts.js';
import type { ChatGptMcpStorageConfig } from './runtimeConfig.js';
import { IngestError } from './validation.js';

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_IMAGE_PIXELS = 40_000_000;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4(address);
  }
  if (version !== 6) {
    return true;
  }

  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice('::ffff:'.length));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff')
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname) || hostname === 'localhost') {
    throw new IngestError('Photo download host is not allowed.', 'invalid_input');
  }
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new IngestError('Photo download host could not be resolved.', 'download_failed');
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new IngestError('Photo download host is not public.', 'invalid_input');
  }
}

class SecurePhotoDownloader implements PhotoDownloader {
  async download(url: URL, maximumBytes: number): Promise<DownloadedPhoto> {
    await assertPublicHost(url.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { Accept: 'image/jpeg,image/png,image/webp' }
      });
      if (!response.ok || !response.body) {
        throw new IngestError('ChatGPT photo download failed.', 'download_failed');
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (
        Number.isFinite(contentLength) &&
        (contentLength <= 0 || contentLength > maximumBytes)
      ) {
        throw new IngestError('Photo size is invalid.', 'unsupported_image');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maximumBytes) {
          await reader.cancel();
          throw new IngestError('Photo size is invalid.', 'unsupported_image');
        }
        chunks.push(value);
      }

      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return {
        bytes,
        contentType: response.headers.get('content-type') ?? undefined
      };
    } catch (error) {
      if (error instanceof IngestError) throw error;
      throw new IngestError('ChatGPT photo download failed.', 'download_failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function encodeImage(
  pipeline: Sharp,
  mimeType: SupportedImageType
): Sharp {
  if (mimeType === 'image/png') {
    return pipeline.png({ compressionLevel: 9, progressive: true });
  }
  if (mimeType === 'image/webp') {
    return pipeline.webp({ quality: 86, effort: 5 });
  }
  return pipeline.jpeg({ quality: 88, progressive: true, mozjpeg: true });
}

class SharpPhotoSanitizer implements PhotoSanitizer {
  async sanitize(
    bytes: Uint8Array,
    mimeType: SupportedImageType
  ): Promise<SanitizedPhoto> {
    const input = Buffer.from(bytes);
    const baseOptions = {
      failOn: 'warning' as const,
      limitInputPixels: MAX_IMAGE_PIXELS
    };

    try {
      const master = await encodeImage(
        sharp(input, baseOptions)
          .rotate()
          .resize({
            width: 1800,
            height: 1800,
            fit: 'inside',
            withoutEnlargement: true
          }),
        mimeType
      ).toBuffer({ resolveWithObject: true });
      const thumbnail = await encodeImage(
        sharp(input, baseOptions)
          .rotate()
          .resize({
            width: 640,
            height: 640,
            fit: 'inside',
            withoutEnlargement: true
          }),
        mimeType
      ).toBuffer({ resolveWithObject: true });

      if (
        !master.info.width ||
        !master.info.height ||
        !thumbnail.info.width ||
        !thumbnail.info.height
      ) {
        throw new Error('Missing image dimensions.');
      }
      return {
        masterBytes: master.data,
        thumbnailBytes: thumbnail.data,
        masterWidth: master.info.width,
        masterHeight: master.info.height,
        thumbnailWidth: thumbnail.info.width,
        thumbnailHeight: thumbnail.info.height
      };
    } catch {
      throw new IngestError('Photo could not be sanitized.', 'unsupported_image');
    }
  }
}

class VercelPrivateMediaStore implements PrivateMediaStore {
  constructor(private readonly token: string) {}

  async putSanitizedPair(input: {
    masterObjectKey: string;
    thumbnailObjectKey: string;
    masterBytes: Uint8Array;
    thumbnailBytes: Uint8Array;
    mimeType: SupportedImageType;
  }): Promise<void> {
    await put(input.masterObjectKey, Buffer.from(input.masterBytes), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: input.mimeType,
      token: this.token
    });
    try {
      await put(input.thumbnailObjectKey, Buffer.from(input.thumbnailBytes), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: input.mimeType,
        token: this.token
      });
    } catch (error) {
      await del(input.masterObjectKey, { token: this.token }).catch(() => undefined);
      throw error;
    }
  }

  async deleteSanitizedPair(input: {
    masterObjectKey: string;
    thumbnailObjectKey: string;
  }): Promise<void> {
    await del([input.masterObjectKey, input.thumbnailObjectKey], {
      token: this.token
    });
  }
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

function mapAsset(row: Row): StoredMediaAsset {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    contentSha256: asString(row.content_sha256),
    mimeType: asString(row.detected_mime) as SupportedImageType,
    byteLength: Number(row.source_bytes),
    masterWidth: Number(row.master_width),
    masterHeight: Number(row.master_height),
    thumbnailWidth: Number(row.thumbnail_width),
    thumbnailHeight: Number(row.thumbnail_height),
    sanitizedMasterObjectKey: asString(row.sanitized_master_object_key),
    thumbnailObjectKey: asString(row.thumbnail_object_key),
    rawOriginalPurgedAt: new Date(asString(row.raw_original_purged_at)).toISOString(),
    sanitizedAt: new Date(asString(row.sanitized_at)).toISOString(),
    masterDeleteAfter: new Date(asString(row.master_delete_after)).toISOString()
  };
}

function mapMeal(row: Row): PrivateMealRecord {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    idempotencyKeyHash: asString(row.idempotency_key_hash),
    requestDigest: asString(row.request_digest),
    source: asString(row.source) as PrivateMealRecord['source'],
    localDate: asString(row.local_date).slice(0, 10),
    timezone: asString(row.timezone),
    mealType: asString(row.meal_type) as PrivateMealRecord['mealType'],
    foodLabels: asStringArray(row.food_labels),
    preparationMethods: asStringArray(row.preparation_methods),
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    mediaAssetIds: asStringArray(row.media_asset_ids),
    createdAt: new Date(asString(row.created_at)).toISOString()
  };
}

const ASSET_COLUMNS = `
  id, owner_id, content_sha256, detected_mime, source_bytes,
  master_width, master_height, thumbnail_width, thumbnail_height,
  sanitized_master_object_key, thumbnail_object_key,
  sanitized_at::text as sanitized_at,
  raw_original_purged_at::text as raw_original_purged_at,
  master_delete_after::text as master_delete_after
`;

class NeonMediaAssetRepository implements MediaAssetRepository {
  constructor(
    private readonly sql: Sql,
    private readonly mediaStore: PrivateMediaStore
  ) {}

  async getOrCreateByContentHash(
    ownerId: string,
    contentSha256: string,
    create: () => Promise<Omit<StoredMediaAsset, 'id'>>
  ): Promise<{ asset: StoredMediaAsset; created: boolean }> {
    const existingResult = await this.sql.transaction((tx) => [
      tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
      tx.query(
        `select ${ASSET_COLUMNS} from media_assets
         where owner_id = $1 and content_sha256 = $2`,
        [ownerId, contentSha256]
      )
    ]);
    const existing = existingResult[1][0] as Row | undefined;
    if (existing) return { asset: mapAsset(existing), created: false };

    const draft = await create();
    const id = randomUUID();
    try {
      const results = await this.sql.transaction((tx) => [
        tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
        tx.query(
          `insert into media_assets (
             id, owner_id, content_sha256, detected_mime, source_bytes,
             master_width, master_height, thumbnail_width, thumbnail_height,
             sanitized_master_object_key, thumbnail_object_key, sanitized_at,
             raw_original_purged_at, master_delete_after
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
           )
           on conflict (owner_id, content_sha256) do nothing
           returning ${ASSET_COLUMNS}`,
          [
            id,
            ownerId,
            contentSha256,
            draft.mimeType,
            draft.byteLength,
            draft.masterWidth,
            draft.masterHeight,
            draft.thumbnailWidth,
            draft.thumbnailHeight,
            draft.sanitizedMasterObjectKey,
            draft.thumbnailObjectKey,
            draft.sanitizedAt,
            draft.rawOriginalPurgedAt,
            draft.masterDeleteAfter
          ]
        ),
        tx.query(
          `select ${ASSET_COLUMNS} from media_assets
           where owner_id = $1 and content_sha256 = $2`,
          [ownerId, contentSha256]
        )
      ]);
      const inserted = results[1][0] as Row | undefined;
      const selected = (inserted ?? results[2][0]) as Row | undefined;
      if (!selected) throw new Error('Media asset insert did not resolve.');
      if (!inserted) {
        await this.mediaStore
          .deleteSanitizedPair({
            masterObjectKey: draft.sanitizedMasterObjectKey,
            thumbnailObjectKey: draft.thumbnailObjectKey
          })
          .catch(() => undefined);
      }
      return { asset: mapAsset(selected), created: Boolean(inserted) };
    } catch (error) {
      await this.mediaStore
        .deleteSanitizedPair({
          masterObjectKey: draft.sanitizedMasterObjectKey,
          thumbnailObjectKey: draft.thumbnailObjectKey
        })
        .catch(() => undefined);
      throw error;
    }
  }
}

const MEAL_SELECT = `
  select
    me.id, me.owner_id, ir.idempotency_key_hash, ir.request_digest,
    me.local_date::text as local_date, me.timezone, me.meal_type, me.source,
    me.food_labels, me.preparation_methods, me.notes, me.created_at::text,
    coalesce(
      json_agg(mp.media_asset_id::text order by mp.ordinal)
        filter (where mp.media_asset_id is not null),
      '[]'::json
    ) as media_asset_ids
  from ingest_requests ir
  join meal_entries me on me.id = ir.meal_entry_id
  left join meal_photos mp on mp.meal_entry_id = me.id
  where ir.owner_id = $1 and ir.idempotency_key_hash = $2
  group by me.id, ir.idempotency_key_hash, ir.request_digest
`;

class NeonMealRepository implements MealRepository {
  constructor(private readonly sql: Sql) {}

  async findByIdempotencyKeyHash(
    ownerId: string,
    idempotencyKeyHash: string
  ): Promise<PrivateMealRecord | undefined> {
    const results = await this.sql.transaction((tx) => [
      tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
      tx.query(MEAL_SELECT, [ownerId, idempotencyKeyHash])
    ]);
    const row = results[1][0] as Row | undefined;
    return row ? mapMeal(row) : undefined;
  }

  async createOnce(
    record: Omit<PrivateMealRecord, 'id'>,
    mediaAssets: readonly StoredMediaAsset[]
  ): Promise<{ record: PrivateMealRecord; created: boolean }> {
    const requestId = randomUUID();
    const mealId = randomUUID();
    const snapshot = JSON.stringify({
      local_date: record.localDate,
      meal_type: record.mealType,
      photo_count: mediaAssets.length,
      status: 'recorded'
    });

    const results = await this.sql.transaction((tx) => {
      const queries = [
        tx.query(`select set_config('app.owner_id', $1, true)`, [record.ownerId]),
        tx.query(
          `insert into ingest_requests (
             id, owner_id, idempotency_key_hash, request_digest, status
           ) values ($1, $2, $3, $4, 'processing')
           on conflict (owner_id, idempotency_key_hash) do nothing
           returning id`,
          [
            requestId,
            record.ownerId,
            record.idempotencyKeyHash,
            record.requestDigest
          ]
        ),
        tx.query(
          `insert into meal_entries (
             id, owner_id, local_date, timezone, meal_type, food_labels,
             preparation_methods, notes, source, created_at, updated_at
           )
           select $1, $2, $3::date, $4, $5, $6::jsonb, $7::jsonb, $8,
                  $9, $10::timestamptz, $10::timestamptz
           where exists (
             select 1 from ingest_requests
             where id = $11 and owner_id = $2 and status = 'processing'
           )`,
          [
            mealId,
            record.ownerId,
            record.localDate,
            record.timezone,
            record.mealType,
            JSON.stringify(record.foodLabels),
            JSON.stringify(record.preparationMethods),
            record.notes ?? null,
            record.source,
            record.createdAt,
            requestId
          ]
        ),
        ...mediaAssets.map((asset, ordinal) =>
          tx.query(
            `insert into meal_photos (meal_entry_id, media_asset_id, ordinal)
             select $1, $2, $3
             where exists (
               select 1 from meal_entries where id = $1 and owner_id = $4
             )`,
            [mealId, asset.id, ordinal, record.ownerId]
          )
        ),
        tx.query(
          `update ingest_requests
           set status = 'recorded', meal_entry_id = $1,
               response_snapshot = $2::jsonb, updated_at = now()
           where id = $3 and owner_id = $4`,
          [mealId, snapshot, requestId, record.ownerId]
        ),
        tx.query(MEAL_SELECT, [record.ownerId, record.idempotencyKeyHash])
      ];
      return queries;
    });

    const insertedRequest = results[1][0] as Row | undefined;
    const selectedRows = results[results.length - 1];
    const selected = selectedRows[0] as Row | undefined;
    if (!selected) throw new Error('Meal insert did not resolve.');
    return { record: mapMeal(selected), created: Boolean(insertedRequest) };
  }
}

function hmac(secret: string, purpose: string, ...parts: string[]): string {
  const value = [purpose, ...parts].join('\0');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createProductionRecordMealDependencies(
  config: ChatGptMcpStorageConfig
): RecordMealDependencies {
  const sql = neon(config.databaseUrl);
  const mediaStore = new VercelPrivateMediaStore(config.privateBlobToken);
  const allowedHosts = new Set(config.attachmentHosts);

  return {
    downloader: new SecurePhotoDownloader(),
    sanitizer: new SharpPhotoSanitizer(),
    mediaAssets: new NeonMediaAssetRepository(sql, mediaStore),
    mediaStore,
    meals: new NeonMealRepository(sql),
    clock: { now: () => new Date() },
    allowDownloadUrl: (url) =>
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.port === '' || url.port === '443') &&
      allowedHosts.has(url.hostname.toLowerCase()),
    fingerprintIdempotencyKey: (ownerId, key) =>
      hmac(config.ingestHmacSecret, 'idempotency', ownerId, key),
    fingerprintSourceFile: (ownerId, fileId) =>
      hmac(config.ingestHmacSecret, 'source-file', ownerId, fileId),
    buildPrivateObjectKeys: (ownerId) => {
      const opaqueOwner = hmac(config.ingestHmacSecret, 'object-owner', ownerId);
      const id = randomUUID();
      return {
        master: `private/${opaqueOwner}/${id}-master.image`,
        thumbnail: `private/${opaqueOwner}/${id}-thumbnail.image`
      };
    }
  };
}

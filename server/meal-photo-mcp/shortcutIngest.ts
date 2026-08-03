import { createHash } from 'node:crypto';
import type {
  ChatGptFileParam,
  MealType,
  PrivateMealRecord,
  RecordMealDependencies,
  RecordMealInput,
  RecordMealResult,
  StoredMediaAsset,
  SupportedImageType
} from './contracts.js';
import {
  IngestError,
  MAX_PHOTOS_PER_MEAL,
  validateRecordMealInput,
  verifyDownloadedPhoto
} from './validation.js';

const MASTER_RETENTION_DAYS = 30;
export const MAX_SHORTCUT_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_SHORTCUT_TOTAL_BYTES = 3 * 1024 * 1024;

export interface ShortcutPhotoInput {
  data_base64: string;
  mime_type?: string;
  file_name?: string;
}

export interface ShortcutMealInput {
  photos: ShortcutPhotoInput[];
  client_request_id: string;
  local_date: string;
  timezone: string;
  meal_type: MealType;
  food_labels?: string[];
  preparation_methods?: string[];
  notes?: string;
}

interface DecodedPhoto {
  bytes: Uint8Array;
  mimeType: SupportedImageType;
  contentSha256: string;
}

function hasValidClientRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 8 &&
    value.length <= 128
  );
}

function formatDateInTimeZone(
  date: Date,
  timeZone: unknown
): string | undefined {
  if (typeof timeZone !== 'string' || Number.isNaN(date.getTime())) {
    return undefined;
  }
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const part = (type: 'year' | 'month' | 'day') =>
      parts.find((item) => item.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    return year && month && day ? `${year}-${month}-${day}` : undefined;
  } catch {
    return undefined;
  }
}

function dateInTimeZone(value: string, timeZone: unknown): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  return formatDateInTimeZone(new Date(value), timeZone);
}

function normalizeShortcutLocalDate(
  value: unknown,
  timeZone: unknown,
  fallbackDate?: Date
): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // Depending on the iPhone language and the chosen Shortcuts magic
    // variable, a date can arrive as localized display text even when the
    // Format Date action visibly uses a custom format.
    const localized = trimmed.match(
      /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s.*)?$/
    );
    if (localized) {
      return `${localized[1]}-${localized[2].padStart(2, '0')}-${localized[3].padStart(2, '0')}`;
    }

    return (
      dateInTimeZone(trimmed, timeZone) ??
      (fallbackDate
        ? formatDateInTimeZone(fallbackDate, timeZone)
        : undefined) ??
      value
    );
  }

  if (value && typeof value === 'object') {
    const serializedDate = (value as { date?: unknown }).date;
    if (typeof serializedDate === 'string') {
      return (
        dateInTimeZone(serializedDate, timeZone) ??
        (fallbackDate
          ? formatDateInTimeZone(fallbackDate, timeZone)
          : undefined) ??
        value
      );
    }
  }

  return fallbackDate
    ? formatDateInTimeZone(fallbackDate, timeZone) ?? value
    : value;
}

function fallbackClientRequestId(input: ShortcutMealInput): string {
  const hash = createHash('sha256');
  hash.update('shortcut-fallback-v1\0');
  hash.update(
    JSON.stringify({
      localDate: input.local_date,
      timezone: input.timezone,
      mealType: input.meal_type,
      foodLabels: input.food_labels ?? [],
      preparationMethods: input.preparation_methods ?? [],
      notes: input.notes ?? null
    })
  );

  for (const photo of input.photos) {
    hash.update('\0photo\0');
    hash.update(
      photo && typeof photo === 'object' &&
          typeof photo.data_base64 === 'string'
        ? photo.data_base64.replace(/\s/g, '')
        : 'invalid-photo'
    );
  }

  return `shortcut-fallback-${hash.digest('hex')}`;
}

const datePlusDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

function asRecordMealInput(input: ShortcutMealInput): RecordMealInput {
  return {
    ...input,
    photos: input.photos.map(
      (photo, index): ChatGptFileParam => ({
        download_url: `https://shortcut.invalid/${index}`,
        file_id: `shortcut-photo-${index}`,
        ...(photo.mime_type ? { mime_type: photo.mime_type } : {}),
        ...(photo.file_name ? { file_name: photo.file_name } : {})
      })
    )
  };
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string') {
    throw new IngestError('Photo data is invalid.', 'invalid_input');
  }
  // Shortcuts normally emits plain padded Base64, but some iOS versions and
  // actions serialize it as a data URL, omit trailing padding, or use the
  // URL-safe alphabet. All of those forms represent the same image bytes.
  const withoutDataUrl = value.replace(
    /^data:image\/(?:jpeg|jpg|png|webp);base64,/i,
    ''
  );
  const compact = withoutDataUrl.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const remainder = compact.length % 4;
  const normalized =
    remainder === 2 ? `${compact}==` : remainder === 3 ? `${compact}=` : compact;
  if (
    normalized.length === 0 ||
    remainder === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throw new IngestError('Photo data is not valid Base64.', 'invalid_input');
  }

  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_SHORTCUT_PHOTO_BYTES) {
    throw new IngestError('Shortcut photo is too large.', 'unsupported_image');
  }
  return new Uint8Array(bytes);
}

export function parseShortcutMealInput(
  value: unknown,
  options: { fallbackDate?: Date } = {}
): {
  input: ShortcutMealInput;
  decodedPhotos: DecodedPhoto[];
} {
  if (!value || typeof value !== 'object') {
    throw new IngestError('Meal data is invalid.', 'invalid_input');
  }
  const receivedInput = value as ShortcutMealInput;
  const receivedRecord = value as Record<string, unknown>;

  if (
    !Array.isArray(receivedInput.photos) ||
    receivedInput.photos.length < 1 ||
    receivedInput.photos.length > MAX_PHOTOS_PER_MEAL
  ) {
    throw new IngestError('A meal must contain one to four photos.', 'invalid_input');
  }
  // This endpoint is separately protected by the private Shortcut bearer token.
  // Older iOS Shortcut copies can serialize a Date magic variable instead of the
  // intended request-id text. Derive a stable, payload-bound id for those copies
  // without relaxing the shared ChatGPT/MCP input validation contract.
  const normalizedInput = {
    ...receivedInput,
    local_date: normalizeShortcutLocalDate(
      receivedRecord.local_date,
      receivedRecord.timezone,
      options.fallbackDate
    ) as string
  };
  const input: ShortcutMealInput = {
    ...normalizedInput,
    client_request_id: hasValidClientRequestId(
      receivedInput.client_request_id
    )
      ? receivedInput.client_request_id
      : fallbackClientRequestId(normalizedInput)
  };
  const validationInput = asRecordMealInput(input);
  validateRecordMealInput(validationInput);

  let totalBytes = 0;
  const decodedPhotos = input.photos.map((photo, index) => {
    if (!photo || typeof photo !== 'object') {
      throw new IngestError('Photo data is invalid.', 'invalid_input');
    }
    const bytes = decodeBase64(photo.data_base64);
    totalBytes += bytes.length;
    const metadata = validationInput.photos[index];
    const mimeType = verifyDownloadedPhoto(metadata, bytes);
    return {
      bytes,
      mimeType,
      contentSha256: createHash('sha256').update(bytes).digest('hex')
    };
  });

  if (totalBytes > MAX_SHORTCUT_TOTAL_BYTES) {
    throw new IngestError(
      'Combined Shortcut photos are too large.',
      'unsupported_image'
    );
  }

  return { input, decodedPhotos };
}

function requestDigest(
  input: ShortcutMealInput,
  sourceFileFingerprints: readonly string[]
): string {
  const canonical = JSON.stringify({
    localDate: input.local_date,
    timezone: input.timezone,
    mealType: input.meal_type,
    foodLabels: input.food_labels ?? [],
    preparationMethods: input.preparation_methods ?? [],
    notes: input.notes ?? null,
    sourceFileFingerprints
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function toResult(
  record: PrivateMealRecord,
  reusedPhotoCount: number,
  status: RecordMealResult['status']
): RecordMealResult {
  return {
    local_date: record.localDate,
    meal_type: record.mealType,
    photo_count: record.mediaAssetIds.length,
    reused_photo_count: reusedPhotoCount,
    status
  };
}

export async function recordShortcutMeal(
  value: unknown,
  ownerId: string,
  dependencies: RecordMealDependencies
): Promise<RecordMealResult> {
  const now = dependencies.clock.now();
  // This private Shortcut endpoint records a meal at submission time. Some
  // iOS versions serialize the Current Date magic variable as an opaque object
  // that cannot be normalized reliably. In that legacy case, derive the date
  // from the trusted server clock in the supplied IANA timezone instead of
  // rejecting the photo. Recognized client dates remain validated unchanged.
  const { input, decodedPhotos } = parseShortcutMealInput(value, {
    fallbackDate: now
  });
  const idempotencyKeyHash = dependencies.fingerprintIdempotencyKey(
    ownerId,
    input.client_request_id
  );
  const sourceFileFingerprints = decodedPhotos.map((photo) =>
    dependencies.fingerprintSourceFile(
      ownerId,
      `shortcut:${photo.contentSha256}`
    )
  );
  const digest = requestDigest(input, sourceFileFingerprints);
  const existing = await dependencies.meals.findByIdempotencyKeyHash(
    ownerId,
    idempotencyKeyHash
  );

  if (existing) {
    if (existing.requestDigest !== digest) {
      throw new IngestError(
        'This idempotency key was already used for different meal data.',
        'idempotency_conflict'
      );
    }
    return toResult(
      existing,
      existing.mediaAssetIds.length,
      'already_recorded'
    );
  }

  const assets: StoredMediaAsset[] = [];
  const linkedAssetIds = new Set<string>();
  let reusedPhotoCount = 0;

  for (const photo of decodedPhotos) {
    const stored = await dependencies.mediaAssets.getOrCreateByContentHash(
      ownerId,
      photo.contentSha256,
      async () => {
        const sanitized = await dependencies.sanitizer.sanitize(
          photo.bytes,
          photo.mimeType
        );
        const keys = dependencies.buildPrivateObjectKeys(ownerId);
        const sanitizedAt = dependencies.clock.now().toISOString();

        await dependencies.mediaStore.putSanitizedPair({
          masterObjectKey: keys.master,
          thumbnailObjectKey: keys.thumbnail,
          masterBytes: sanitized.masterBytes,
          thumbnailBytes: sanitized.thumbnailBytes,
          mimeType: photo.mimeType
        });

        return {
          ownerId,
          contentSha256: photo.contentSha256,
          mimeType: photo.mimeType,
          byteLength: photo.bytes.length,
          masterWidth: sanitized.masterWidth,
          masterHeight: sanitized.masterHeight,
          thumbnailWidth: sanitized.thumbnailWidth,
          thumbnailHeight: sanitized.thumbnailHeight,
          sanitizedMasterObjectKey: keys.master,
          thumbnailObjectKey: keys.thumbnail,
          rawOriginalPurgedAt: sanitizedAt,
          sanitizedAt,
          masterDeleteAfter: datePlusDays(now, MASTER_RETENTION_DAYS)
        };
      }
    );

    if (!stored.created) reusedPhotoCount += 1;
    if (linkedAssetIds.has(stored.asset.id)) continue;
    linkedAssetIds.add(stored.asset.id);
    assets.push(stored.asset);
  }

  const created = await dependencies.meals.createOnce(
    {
      ownerId,
      idempotencyKeyHash,
      requestDigest: digest,
      source: 'shortcut',
      localDate: input.local_date,
      timezone: input.timezone,
      mealType: input.meal_type,
      foodLabels: [...(input.food_labels ?? [])],
      preparationMethods: [...(input.preparation_methods ?? [])],
      notes: input.notes,
      mediaAssetIds: assets.map((asset) => asset.id),
      createdAt: dependencies.clock.now().toISOString()
    },
    assets
  );

  if (!created.created && created.record.requestDigest !== digest) {
    throw new IngestError(
      'This idempotency key was concurrently used for different meal data.',
      'idempotency_conflict'
    );
  }

  return toResult(
    created.record,
    created.created ? reusedPhotoCount : created.record.mediaAssetIds.length,
    created.created ? 'recorded' : 'already_recorded'
  );
}

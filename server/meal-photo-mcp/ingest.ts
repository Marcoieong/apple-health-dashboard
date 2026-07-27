import { createHash } from 'node:crypto';
import type {
  AuthContext,
  PrivateMealRecord,
  RecordMealDependencies,
  RecordMealInput,
  RecordMealResult,
  StoredMediaAsset
} from './contracts';
import {
  IngestError,
  MAX_PHOTO_BYTES,
  validateRecordMealInput,
  verifyDownloadedPhoto
} from './validation';

const MASTER_RETENTION_DAYS = 30;

function requireMealWriteScope(auth: AuthContext): string {
  if (!auth.subject || !auth.scopes.includes('meal.write')) {
    throw new IngestError('Authentication with meal.write is required.', 'unauthorized');
  }
  return auth.subject;
}

const datePlusDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

function toResult(
  record: PrivateMealRecord,
  photoCount: number,
  reusedPhotoCount: number,
  status: RecordMealResult['status']
): RecordMealResult {
  return {
    entry_id: record.id,
    local_date: record.localDate,
    meal_type: record.mealType,
    photo_count: photoCount,
    reused_photo_count: reusedPhotoCount,
    status
  };
}

function buildRequestDigest(
  input: RecordMealInput,
  sourceFileFingerprints: readonly string[]
): string {
  const canonicalRequest = JSON.stringify({
    localDate: input.local_date,
    timezone: input.timezone,
    mealType: input.meal_type,
    foodLabels: input.food_labels ?? [],
    preparationMethods: input.preparation_methods ?? [],
    notes: input.notes ?? null,
    sourceFileFingerprints
  });

  return createHash('sha256').update(canonicalRequest).digest('hex');
}

/**
 * Core handler for the ChatGPT-facing `record_meal` MCP tool.
 *
 * Transport, OAuth verification, image codecs, private object storage and SQL
 * are injected adapters. This keeps security ordering and the attachment
 * lifecycle independently testable.
 */
export async function recordMeal(
  input: RecordMealInput,
  auth: AuthContext,
  dependencies: RecordMealDependencies
): Promise<RecordMealResult> {
  // Authentication deliberately precedes input parsing and every network call.
  const ownerId = requireMealWriteScope(auth);
  const downloadUrls = validateRecordMealInput(input);
  const idempotencyKeyHash = dependencies.fingerprintIdempotencyKey(
    ownerId,
    input.client_request_id
  );
  const sourceFileFingerprints = input.photos.map((photo) =>
    dependencies.fingerprintSourceFile(ownerId, photo.file_id)
  );
  const requestDigest = buildRequestDigest(input, sourceFileFingerprints);

  const existing = await dependencies.meals.findByIdempotencyKeyHash(
    ownerId,
    idempotencyKeyHash
  );
  if (existing) {
    if (existing.requestDigest !== requestDigest) {
      throw new IngestError(
        'This idempotency key was already used for different meal data.',
        'idempotency_conflict'
      );
    }
    return toResult(
      existing,
      existing.mediaAssetIds.length,
      existing.mediaAssetIds.length,
      'already_recorded'
    );
  }

  if (downloadUrls.some((url) => !dependencies.allowDownloadUrl(url))) {
    throw new IngestError('Photo download host is not allowed.', 'invalid_input');
  }

  const now = dependencies.clock.now();
  const assets: StoredMediaAsset[] = [];
  const linkedAssetIds = new Set<string>();
  let reusedPhotoCount = 0;

  for (const [index, photo] of input.photos.entries()) {
    let downloaded;
    try {
      // The signed URL is consumed immediately and is never persisted or logged.
      downloaded = await dependencies.downloader.download(
        downloadUrls[index],
        MAX_PHOTO_BYTES
      );
    } catch (error) {
      if (error instanceof IngestError) {
        throw error;
      }
      throw new IngestError('ChatGPT photo could not be downloaded.', 'download_failed');
    }

    const mimeType = verifyDownloadedPhoto(
      photo,
      downloaded.bytes,
      downloaded.contentType
    );
    const contentSha256 = createHash('sha256').update(downloaded.bytes).digest('hex');

    const stored = await dependencies.mediaAssets.getOrCreateByContentHash(
      ownerId,
      contentSha256,
      async () => {
        const sanitized = await dependencies.sanitizer.sanitize(
          downloaded.bytes,
          mimeType
        );
        const keys = dependencies.buildPrivateObjectKeys(ownerId);
        const sanitizedAt = dependencies.clock.now().toISOString();

        await dependencies.mediaStore.putSanitizedPair({
          masterObjectKey: keys.master,
          thumbnailObjectKey: keys.thumbnail,
          masterBytes: sanitized.masterBytes,
          thumbnailBytes: sanitized.thumbnailBytes,
          mimeType
        });

        return {
          ownerId,
          contentSha256,
          mimeType,
          byteLength: downloaded.bytes.length,
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

    if (!stored.created) {
      reusedPhotoCount += 1;
    }
    // The database allows one link from a meal to a given asset. Mobile share
    // sheets can submit the same photo twice, so collapse that duplicate here
    // while retaining it in the request digest for safe replay detection.
    if (linkedAssetIds.has(stored.asset.id)) {
      continue;
    }
    linkedAssetIds.add(stored.asset.id);
    assets.push(stored.asset);
  }

  const createdAt = dependencies.clock.now().toISOString();
  const created = await dependencies.meals.createOnce(
    {
      ownerId,
      idempotencyKeyHash,
      requestDigest,
      source: 'chatgpt',
      localDate: input.local_date,
      timezone: input.timezone,
      mealType: input.meal_type,
      foodLabels: [...(input.food_labels ?? [])],
      preparationMethods: [...(input.preparation_methods ?? [])],
      notes: input.notes,
      mediaAssetIds: assets.map((asset) => asset.id),
      createdAt
    },
    assets
  );

  if (!created.created && created.record.requestDigest !== requestDigest) {
    throw new IngestError(
      'This idempotency key was concurrently used for different meal data.',
      'idempotency_conflict'
    );
  }

  return toResult(
    created.record,
    created.record.mediaAssetIds.length,
    created.created ? reusedPhotoCount : created.record.mediaAssetIds.length,
    created.created ? 'recorded' : 'already_recorded'
  );
}

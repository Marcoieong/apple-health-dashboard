import { describe, expect, it, vi } from 'vitest';
import type {
  MealRepository,
  MediaAssetRepository,
  PrivateMealRecord,
  RecordMealDependencies,
  RecordMealInput,
  StoredMediaAsset
} from './contracts';
import { recordMeal } from './ingest';
import { toMealReadDto } from './publicDto';
import { recordMealToolDescriptor } from './toolDescriptor';
import { detectImageType, IngestError, verifyDownloadedPhoto } from './validation';

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);

const validInput: RecordMealInput = {
  photos: [
    {
      download_url: 'https://files.openai.example/signed/photo',
      file_id: 'opaque-file-reference',
      mime_type: 'image/jpeg',
      file_name: 'dinner.jpg'
    }
  ],
  client_request_id: 'meal-request-20260728-01',
  local_date: '2026-07-28',
  timezone: 'Asia/Macau',
  meal_type: 'dinner',
  food_labels: ['西蘭花', '牛肉'],
  preparation_methods: ['灼', '炆']
};

function createDependencies() {
  const mealRecords = new Map<string, PrivateMealRecord>();
  const mediaRecords = new Map<string, StoredMediaAsset>();
  let assetSequence = 0;
  let mealSequence = 0;

  const mediaAssets: MediaAssetRepository = {
    async getOrCreateByContentHash(ownerId, contentSha256, create) {
      const key = `${ownerId}:${contentSha256}`;
      const existing = mediaRecords.get(key);
      if (existing) {
        return { asset: existing, created: false };
      }

      const draft = await create();
      assetSequence += 1;
      const asset = { ...draft, id: `asset-${assetSequence}` };
      mediaRecords.set(key, asset);
      return { asset, created: true };
    }
  };

  const meals: MealRepository = {
    async findByIdempotencyKeyHash(ownerId, idempotencyKeyHash) {
      return mealRecords.get(`${ownerId}:${idempotencyKeyHash}`);
    },
    async createOnce(record) {
      const key = `${record.ownerId}:${record.idempotencyKeyHash}`;
      const existing = mealRecords.get(key);
      if (existing) {
        return { record: existing, created: false };
      }

      mealSequence += 1;
      const created = { ...record, id: `meal-${mealSequence}` };
      mealRecords.set(key, created);
      return { record: created, created: true };
    }
  };

  const dependencies: RecordMealDependencies = {
    downloader: {
      download: vi.fn(async () => ({
        bytes: jpegBytes,
        contentType: 'image/jpeg'
      }))
    },
    sanitizer: {
      sanitize: vi.fn(async () => ({
        masterBytes: new Uint8Array([1, 2, 3]),
        thumbnailBytes: new Uint8Array([4, 5]),
        masterWidth: 1600,
        masterHeight: 1200,
        thumbnailWidth: 320,
        thumbnailHeight: 240
      }))
    },
    mediaAssets,
    mediaStore: {
      putSanitizedPair: vi.fn(async () => undefined)
    },
    meals,
    clock: {
      now: () => new Date('2026-07-28T12:00:00.000Z')
    },
    allowDownloadUrl: (url) => url.hostname === 'files.openai.example',
    fingerprintIdempotencyKey: (ownerId, key) => `hmac:${ownerId}:${key}`,
    fingerprintSourceFile: (ownerId, fileId) => `hmac:${ownerId}:${fileId}`,
    buildPrivateObjectKeys: () => {
      assetSequence += 1;
      return {
        master: `private/master-${assetSequence}`,
        thumbnail: `private/thumb-${assetSequence}`
      };
    }
  };

  return { dependencies, mealRecords, mediaRecords };
}

describe('ChatGPT file parameter contract', () => {
  it('declares a top-level array with every official file property', () => {
    expect(recordMealToolDescriptor._meta['openai/fileParams']).toEqual(['photos']);

    const photos = recordMealToolDescriptor.inputSchema.properties.photos;
    expect(photos.minItems).toBe(1);
    expect(photos.maxItems).toBe(4);
    expect(Object.keys(photos.items.properties)).toEqual([
      'download_url',
      'file_id',
      'mime_type',
      'file_name'
    ]);
    expect(photos.items.required).toEqual(['download_url', 'file_id']);
    expect(recordMealToolDescriptor.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true
    });
  });

  it('does not expose attachment fields in the tool output schema', () => {
    const serialized = JSON.stringify(recordMealToolDescriptor.outputSchema);
    expect(serialized).not.toContain('download_url');
    expect(serialized).not.toContain('file_id');
  });
});

describe('food photo validation', () => {
  it('detects supported formats from magic bytes', () => {
    expect(detectImageType(jpegBytes)).toBe('image/jpeg');
    expect(
      detectImageType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png');
    expect(
      detectImageType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50
        ])
      )
    ).toBe('image/webp');
  });

  it('rejects declared MIME that disagrees with file contents', () => {
    expect(() =>
      verifyDownloadedPhoto(
        {
          download_url: 'https://files.openai.example/photo',
          file_id: 'file',
          mime_type: 'image/png'
        },
        jpegBytes,
        'image/jpeg'
      )
    ).toThrow(IngestError);
  });

  it('rejects impossible dates, unknown timezones and malformed labels', async () => {
    const { dependencies } = createDependencies();
    const auth = { subject: 'owner-a', scopes: ['meal.write'] };

    await expect(
      recordMeal({ ...validInput, local_date: '2026-02-30' }, auth, dependencies)
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      recordMeal({ ...validInput, timezone: 'Mars/Olympus' }, auth, dependencies)
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      recordMeal(
        { ...validInput, food_labels: ['   '] },
        auth,
        dependencies
      )
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});

describe('recordMeal security and idempotency', () => {
  it('authenticates before validating or downloading the attachment', async () => {
    const { dependencies } = createDependencies();

    await expect(
      recordMeal(
        { ...validInput, photos: [] },
        { scopes: [] },
        dependencies
      )
    ).rejects.toMatchObject({ code: 'unauthorized' });

    expect(dependencies.downloader.download).not.toHaveBeenCalled();
  });

  it('downloads immediately, stores only sanitized images, and replays safely', async () => {
    const { dependencies, mealRecords, mediaRecords } = createDependencies();
    const auth = { subject: 'owner-a', scopes: ['meal.write'] };

    const first = await recordMeal(validInput, auth, dependencies);
    const replay = await recordMeal(validInput, auth, dependencies);

    expect(first).toMatchObject({
      entry_id: 'meal-1',
      status: 'recorded',
      photo_count: 1,
      reused_photo_count: 0
    });
    expect(replay).toMatchObject({
      entry_id: 'meal-1',
      status: 'already_recorded',
      photo_count: 1
    });
    expect(dependencies.downloader.download).toHaveBeenCalledTimes(1);
    expect(dependencies.sanitizer.sanitize).toHaveBeenCalledTimes(1);
    expect(dependencies.mediaStore.putSanitizedPair).toHaveBeenCalledTimes(1);
    expect(mealRecords.size).toBe(1);
    expect(mediaRecords.size).toBe(1);
  });

  it('rejects reuse of one idempotency key for different meal data', async () => {
    const { dependencies } = createDependencies();
    const auth = { subject: 'owner-a', scopes: ['meal.write'] };

    await recordMeal(validInput, auth, dependencies);

    await expect(
      recordMeal(
        { ...validInput, meal_type: 'snack' },
        auth,
        dependencies
      )
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(dependencies.downloader.download).toHaveBeenCalledTimes(1);
  });

  it('deduplicates identical bytes for one owner but not across owners', async () => {
    const { dependencies, mediaRecords } = createDependencies();

    await recordMeal(validInput, { subject: 'owner-a', scopes: ['meal.write'] }, dependencies);
    await recordMeal(
      {
        ...validInput,
        client_request_id: 'meal-request-20260728-02',
        meal_type: 'snack'
      },
      { subject: 'owner-a', scopes: ['meal.write'] },
      dependencies
    );
    await recordMeal(
      {
        ...validInput,
        client_request_id: 'meal-request-20260728-03'
      },
      { subject: 'owner-b', scopes: ['meal.write'] },
      dependencies
    );

    expect(mediaRecords.size).toBe(2);
    expect(dependencies.sanitizer.sanitize).toHaveBeenCalledTimes(2);
  });

  it('links the same submitted photo only once within a meal', async () => {
    const { dependencies, mealRecords } = createDependencies();
    const auth = { subject: 'owner-a', scopes: ['meal.write'] };
    const duplicatePhotoInput = {
      ...validInput,
      photos: [validInput.photos[0], { ...validInput.photos[0], file_id: 'second-ref' }]
    };

    const result = await recordMeal(duplicatePhotoInput, auth, dependencies);
    const [record] = mealRecords.values();

    expect(result).toMatchObject({
      photo_count: 1,
      reused_photo_count: 1,
      status: 'recorded'
    });
    expect(record.mediaAssetIds).toHaveLength(1);
  });
});

describe('read DTO privacy allowlist', () => {
  it('omits owner, hashes, object keys and source attachment metadata', () => {
    const record: PrivateMealRecord = {
      id: 'meal-safe',
      ownerId: 'OWNER_SECRET',
      idempotencyKeyHash: 'IDEMPOTENCY_SECRET',
      requestDigest: 'REQUEST_DIGEST_SECRET',
      source: 'chatgpt',
      localDate: '2026-07-28',
      timezone: 'Asia/Macau',
      mealType: 'dinner',
      foodLabels: ['蔬菜'],
      preparationMethods: ['蒸'],
      mediaAssetIds: ['asset-safe'],
      createdAt: '2026-07-28T12:00:00.000Z'
    };
    const asset: StoredMediaAsset = {
      id: 'asset-safe',
      ownerId: 'OWNER_SECRET',
      contentSha256: 'HASH_SECRET',
      mimeType: 'image/jpeg',
      byteLength: 999,
      masterWidth: 1600,
      masterHeight: 1200,
      thumbnailWidth: 320,
      thumbnailHeight: 240,
      sanitizedMasterObjectKey: 'MASTER_KEY_SECRET',
      thumbnailObjectKey: 'THUMB_KEY_SECRET',
      rawOriginalPurgedAt: '2026-07-28T12:00:00.000Z',
      sanitizedAt: '2026-07-28T12:00:00.000Z',
      masterDeleteAfter: '2026-08-27T12:00:00.000Z'
    };

    const dto = toMealReadDto(record, [asset]);
    const serialized = JSON.stringify(dto);

    for (const secret of [
      'OWNER_SECRET',
      'IDEMPOTENCY_SECRET',
      'REQUEST_DIGEST_SECRET',
      'HASH_SECRET',
      'MASTER_KEY_SECRET',
      'THUMB_KEY_SECRET'
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(dto.photos[0].thumbnailUrl).toBe(
      '/api/meals/meal-safe/photos/0/thumbnail'
    );
    expect(dto.photos[0]).toMatchObject({ width: 320, height: 240 });
  });
});

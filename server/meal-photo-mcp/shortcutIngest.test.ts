import { describe, expect, it, vi } from 'vitest';
import type {
  MealRepository,
  MediaAssetRepository,
  PrivateMealRecord,
  RecordMealDependencies,
  StoredMediaAsset
} from './contracts.js';
import {
  parseShortcutMealInput,
  recordShortcutMeal,
  type ShortcutMealInput
} from './shortcutIngest.js';

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
const jpegBase64 = Buffer.from(jpegBytes).toString('base64');

const validInput: ShortcutMealInput = {
  photos: [
    {
      data_base64: jpegBase64,
      mime_type: 'image/jpeg',
      file_name: 'meal.jpg'
    }
  ],
  client_request_id: 'shortcut-20260729-01',
  local_date: '2026-07-29',
  timezone: 'Asia/Macau',
  meal_type: 'dinner',
  food_labels: ['魚', '蔬菜'],
  preparation_methods: ['蒸']
};

function createDependencies() {
  const mealRecords = new Map<string, PrivateMealRecord>();
  const mediaRecords = new Map<string, StoredMediaAsset>();
  let sequence = 0;

  const mediaAssets: MediaAssetRepository = {
    async getOrCreateByContentHash(ownerId, contentSha256, create) {
      const key = `${ownerId}:${contentSha256}`;
      const existing = mediaRecords.get(key);
      if (existing) return { asset: existing, created: false };
      const asset = { ...(await create()), id: `asset-${++sequence}` };
      mediaRecords.set(key, asset);
      return { asset, created: true };
    }
  };

  const meals: MealRepository = {
    async findByIdempotencyKeyHash(ownerId, hash) {
      return mealRecords.get(`${ownerId}:${hash}`);
    },
    async createOnce(record) {
      const key = `${record.ownerId}:${record.idempotencyKeyHash}`;
      const existing = mealRecords.get(key);
      if (existing) return { record: existing, created: false };
      const created = { ...record, id: `meal-${++sequence}` };
      mealRecords.set(key, created);
      return { record: created, created: true };
    }
  };

  const dependencies: RecordMealDependencies = {
    downloader: {
      download: vi.fn(async () => {
        throw new Error('Shortcut must not download remote photos.');
      })
    },
    sanitizer: {
      sanitize: vi.fn(async () => ({
        masterBytes: new Uint8Array([1, 2, 3]),
        thumbnailBytes: new Uint8Array([4, 5]),
        masterWidth: 1200,
        masterHeight: 800,
        thumbnailWidth: 480,
        thumbnailHeight: 320
      }))
    },
    mediaAssets,
    mediaStore: {
      putSanitizedPair: vi.fn(async () => undefined),
      deleteSanitizedPair: vi.fn(async () => undefined)
    },
    meals,
    clock: { now: () => new Date('2026-07-29T12:00:00.000Z') },
    allowDownloadUrl: () => false,
    fingerprintIdempotencyKey: (owner, key) => `key:${owner}:${key}`,
    fingerprintSourceFile: (owner, file) => `file:${owner}:${file}`,
    buildPrivateObjectKeys: () => ({
      master: `private/master-${sequence}`,
      thumbnail: `private/thumb-${sequence}`
    })
  };

  return { dependencies, mealRecords, mediaRecords };
}

describe('Shortcut meal parsing', () => {
  it('accepts direct Base64 image bytes and verifies magic bytes', () => {
    const parsed = parseShortcutMealInput(validInput);
    expect(parsed.decodedPhotos).toHaveLength(1);
    expect(parsed.decodedPhotos[0].mimeType).toBe('image/jpeg');
  });

  it('accepts common iPhone Shortcut Base64 variants', () => {
    const unpadded = jpegBase64.replace(/=+$/, '');
    const dataUrl = `data:image/jpeg;base64,${unpadded}`;

    const parsed = parseShortcutMealInput({
      ...validInput,
      photos: [{ data_base64: dataUrl, mime_type: 'image/jpeg' }]
    });

    expect(parsed.decodedPhotos).toHaveLength(1);
    expect(parsed.decodedPhotos[0].mimeType).toBe('image/jpeg');
  });

  it('derives a stable request id when an older Shortcut sends a Date value', () => {
    const legacyInput = {
      ...validInput,
      client_request_id: { date: '2026-07-29T12:00:00.000Z' }
    } as unknown as ShortcutMealInput;

    const first = parseShortcutMealInput(legacyInput);
    const second = parseShortcutMealInput(legacyInput);

    expect(first.input.client_request_id).toMatch(
      /^shortcut-fallback-[a-f0-9]{64}$/
    );
    expect(second.input.client_request_id).toBe(
      first.input.client_request_id
    );
  });

  it('normalizes an iPhone localized meal date without weakening validation', () => {
    const parsed = parseShortcutMealInput({
      ...validInput,
      local_date: '2026年8月3日 12:27'
    });

    expect(parsed.input.local_date).toBe('2026-08-03');
  });

  it('normalizes an iPhone Date object in the supplied timezone', () => {
    const parsed = parseShortcutMealInput({
      ...validInput,
      local_date: { date: '2026-07-29T16:30:00.000Z' }
    });

    expect(parsed.input.local_date).toBe('2026-07-30');
  });

  it('still rejects an unrecognized meal date', () => {
    expect(() =>
      parseShortcutMealInput({
        ...validInput,
        local_date: 'today'
      })
    ).toThrow('Meal date must use YYYY-MM-DD.');
  });

  it('rejects missing photos, malformed Base64 and MIME mismatches', () => {
    expect(() =>
      parseShortcutMealInput({ ...validInput, photos: [] })
    ).toThrow();
    expect(() =>
      parseShortcutMealInput({
        ...validInput,
        photos: [{ data_base64: 'not-base64!' }]
      })
    ).toThrow();
    expect(() =>
      parseShortcutMealInput({
        ...validInput,
        photos: [{ data_base64: jpegBase64, mime_type: 'image/png' }]
      })
    ).toThrow();
  });
});

describe('Shortcut meal ingest', () => {
  it('stores only sanitized bytes with Shortcut source and replays safely', async () => {
    const { dependencies, mealRecords, mediaRecords } = createDependencies();

    const first = await recordShortcutMeal(
      validInput,
      'private-owner',
      dependencies
    );
    const replay = await recordShortcutMeal(
      validInput,
      'private-owner',
      dependencies
    );
    const [record] = mealRecords.values();

    expect(first).toMatchObject({ status: 'recorded', photo_count: 1 });
    expect(replay).toMatchObject({
      status: 'already_recorded',
      photo_count: 1
    });
    expect(record.source).toBe('shortcut');
    expect(mediaRecords.size).toBe(1);
    expect(dependencies.downloader.download).not.toHaveBeenCalled();
    expect(dependencies.sanitizer.sanitize).toHaveBeenCalledTimes(1);
    expect(dependencies.mediaStore.putSanitizedPair).toHaveBeenCalledTimes(1);
  });

  it('replays a legacy Shortcut payload with an invalid request id safely', async () => {
    const { dependencies } = createDependencies();
    const legacyInput = {
      ...validInput,
      client_request_id: '日期'
    } as ShortcutMealInput;

    const first = await recordShortcutMeal(
      legacyInput,
      'private-owner',
      dependencies
    );
    const replay = await recordShortcutMeal(
      legacyInput,
      'private-owner',
      dependencies
    );

    expect(first.status).toBe('recorded');
    expect(replay.status).toBe('already_recorded');
  });

  it('rejects reuse of a request id for different meal data', async () => {
    const { dependencies } = createDependencies();
    await recordShortcutMeal(validInput, 'private-owner', dependencies);

    await expect(
      recordShortcutMeal(
        { ...validInput, meal_type: 'snack' },
        'private-owner',
        dependencies
      )
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });
});

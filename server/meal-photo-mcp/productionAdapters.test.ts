import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createProductionRecordMealDependencies } from './productionAdapters.js';
import type { ChatGptMcpStorageConfig } from './runtimeConfig.js';

const config: ChatGptMcpStorageConfig = {
  databaseUrl:
    'postgresql://test-user:test-password@example.invalid/private?sslmode=require',
  privateBlobToken: 'test-token',
  ingestHmacSecret: 'test-ingest-secret',
  attachmentHosts: ['files.openai.com']
};

describe('production record_meal adapters', () => {
  it('accepts only exact, credential-free HTTPS attachment hosts', () => {
    const dependencies = createProductionRecordMealDependencies(config);

    expect(
      dependencies.allowDownloadUrl(
        new URL('https://files.openai.com/private/photo.jpg?signature=opaque')
      )
    ).toBe(true);
    expect(
      dependencies.allowDownloadUrl(
        new URL('https://sub.files.openai.com/private/photo.jpg')
      )
    ).toBe(false);
    expect(
      dependencies.allowDownloadUrl(
        new URL('https://files.openai.com:444/private/photo.jpg')
      )
    ).toBe(false);
    expect(
      dependencies.allowDownloadUrl(
        new URL('https://user:secret@files.openai.com/private/photo.jpg')
      )
    ).toBe(false);
    expect(
      dependencies.allowDownloadUrl(
        new URL('https://files.openai.com/private/photo.jpg#secret')
      )
    ).toBe(false);
    expect(
      dependencies.allowDownloadUrl(
        new URL('http://files.openai.com/private/photo.jpg')
      )
    ).toBe(false);
  });

  it('re-encodes photos without source EXIF metadata', async () => {
    const source = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 40, g: 120, b: 200 }
      }
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const dependencies = createProductionRecordMealDependencies(config);
    const sanitized = await dependencies.sanitizer.sanitize(
      source,
      'image/jpeg'
    );
    const masterMetadata = await sharp(sanitized.masterBytes).metadata();
    const thumbnailMetadata = await sharp(sanitized.thumbnailBytes).metadata();

    expect(masterMetadata.exif).toBeUndefined();
    expect(thumbnailMetadata.exif).toBeUndefined();
    expect(masterMetadata.width).toBe(800);
    expect(masterMetadata.height).toBe(1200);
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(640);
    expect(thumbnailMetadata.height).toBeLessThanOrEqual(640);
  });
});

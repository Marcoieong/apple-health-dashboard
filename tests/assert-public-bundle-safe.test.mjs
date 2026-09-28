// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertPublicBundleSafe,
  PublicBundlePrivacyError,
  scanPublicBundle
} from '../scripts/assert-public-bundle-safe.mjs';

const temporaryRoots = [];

async function makeBundle() {
  const root = await mkdtemp(join(tmpdir(), 'public-bundle-privacy-'));
  temporaryRoots.push(root);
  await mkdir(join(root, 'assets'));
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  );
});

describe('public bundle privacy scanner', () => {
  it('accepts ordinary frontend and platform vocabulary', async () => {
    const root = await makeBundle();

    await writeFile(
      join(root, 'assets', 'app.js'),
      [
        'const ratio = window.devicePixelRatio;',
        'const keys = Object.keys({ safe: true });',
        'window.postMessage({ ready: true });',
        'window.location.hash = "#daily";',
        'export { keys, ratio };'
      ].join('\n')
    );

    const report = await assertPublicBundleSafe(root);

    expect(report.filesScanned).toBe(1);
    expect(report.findings).toEqual([]);
  });

  it('detects every protected marker family without printing secret values', async () => {
    const root = await makeBundle();

    await writeFile(
      join(root, 'assets', 'unsafe.js'),
      [
        'const a = { download_url: "temporary-secret" };',
        'const b = { fileId: "private-file" };',
        'const c = { object_key: "private/object/path" };',
        'const d = { contentHash: "private-digest" };',
        'const e = { exif: { GPSLatitude: 22 } };',
        'const f = { deviceModel: "private-device" };',
        'const g = { thread_id: "private-thread" };',
        'const h = { messageId: "private-message" };',
        'const i = { owner_id: "private-owner" };'
      ].join('\n')
    );

    const report = await scanPublicBundle(root);
    const markerIds = report.findings.map((finding) => finding.marker);

    expect(markerIds).toEqual(
      expect.arrayContaining([
        'chatgpt-download-url',
        'chatgpt-file-id',
        'storage-object-key',
        'uploaded-content-hash',
        'embedded-exif-metadata',
        'embedded-gps-metadata',
        'embedded-device-metadata',
        'chat-thread-identifier',
        'chat-message-identifier',
        'private-owner-identifier'
      ])
    );

    await expect(assertPublicBundleSafe(root)).rejects.toMatchObject({
      name: 'PublicBundlePrivacyError'
    });

    try {
      await assertPublicBundleSafe(root);
    } catch (error) {
      expect(error).toBeInstanceOf(PublicBundlePrivacyError);
      expect(error.message).not.toContain('temporary-secret');
      expect(error.message).not.toContain('private/object/path');
      expect(error.message).not.toContain('private-digest');
    }
  });

  it('fails closed when the requested public bundle is missing', async () => {
    const root = await makeBundle();
    const missingDirectory = join(root, 'not-built');

    await expect(assertPublicBundleSafe(missingDirectory)).rejects.toThrow(
      'Public bundle directory does not exist'
    );
  });
});

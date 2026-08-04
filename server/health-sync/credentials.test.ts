// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { HealthSyncConfig } from './config.js';
import {
  openHealthSyncCredential,
  sealHealthSyncCredential
} from './credentials.js';

function config(secret: string): HealthSyncConfig {
  return {
    databaseUrl: 'postgresql://example.com/private?sslmode=require',
    tokenKey: new Uint8Array(Buffer.from(secret.padEnd(32, 'x').slice(0, 32))),
    cursorSecret: 'c'.repeat(32)
  };
}

const claims = {
  credentialId: '0ad86f4e-a310-42f9-b329-08a831a415d4',
  ownerId: 'family_owner_1',
  deviceInstallationId: 'device_installation_01'
};

describe('Health sync device credentials', () => {
  it('round trips only the dedicated health.sync claims', async () => {
    const active = config('secret-one');
    const token = await sealHealthSyncCredential(
      claims,
      active,
      new Date(Date.now() + 60_000)
    );
    await expect(openHealthSyncCredential(token, active)).resolves.toEqual(claims);
  });

  it('rejects a token encrypted with another key or with tampered content', async () => {
    const token = await sealHealthSyncCredential(
      claims,
      config('secret-one'),
      new Date(Date.now() + 60_000)
    );
    await expect(
      openHealthSyncCredential(token, config('secret-two'))
    ).resolves.toBeUndefined();
    const segments = token.split('.');
    segments[3] = `${segments[3].slice(0, -1)}${segments[3].endsWith('A') ? 'B' : 'A'}`;
    await expect(
      openHealthSyncCredential(segments.join('.'), config('secret-one'))
    ).resolves.toBeUndefined();
  });
});

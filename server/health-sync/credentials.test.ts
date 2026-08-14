// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthSyncConfig } from './config.js';
import {
  issueHealthSyncCredential,
  openHealthSyncCredential,
  sealHealthSyncCredential
} from './credentials.js';

const databaseMock = vi.hoisted(() => ({
  transaction: vi.fn()
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => databaseMock)
}));

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
  beforeEach(() => {
    databaseMock.transaction.mockReset();
  });

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
    const tamperIndex = Math.floor(segments[3].length / 2);
    segments[3] = `${segments[3].slice(0, tamperIndex)}${
      segments[3][tamperIndex] === 'A' ? 'B' : 'A'
    }${segments[3].slice(tamperIndex + 1)}`;
    await expect(
      openHealthSyncCredential(segments.join('.'), config('secret-one'))
    ).resolves.toBeUndefined();
  });

  it('replaces the same installation credential and releases only the oldest never-used slot at the limit', async () => {
    const queries: Array<{ statement: string; params: unknown[] }> = [];
    databaseMock.transaction.mockImplementation(
      async (
        build: (tx: {
          query: (statement: string, params: unknown[]) => unknown;
        }) => unknown[]
      ) => {
        const operations = build({
          query(statement, params) {
            queries.push({ statement, params });
            if (queries.length === 5) {
              return [
                {
                  id: claims.credentialId,
                  device_installation_id: claims.deviceInstallationId,
                  label: 'iPhone TEST01',
                  created_at: '2026-08-15T04:00:00.000Z',
                  last_used_at: null,
                  expires_at: '2027-08-15T04:00:00.000Z'
                }
              ];
            }
            return [];
          }
        });
        return operations;
      }
    );

    await expect(
      issueHealthSyncCredential(
        claims.ownerId,
        claims.deviceInstallationId,
        'iPhone TEST01',
        config('secret-one')
      )
    ).resolves.toMatchObject({
      deviceInstallationId: claims.deviceInstallationId,
      label: 'iPhone TEST01'
    });

    expect(queries).toHaveLength(5);
    expect(queries[1].statement).toContain('pg_advisory_xact_lock');
    expect(queries[2].statement).toContain('device_installation_id = $2');
    expect(queries[2].statement).not.toContain('last_used_at is null');
    expect(queries[3].statement).toContain('oldest_unused');
    expect(queries[3].statement).toContain('last_used_at is null');
    expect(queries[3].statement).toContain('count(*) - 4');
    expect(queries[4].statement).toContain('insert into health_sync_credentials');
  });
});

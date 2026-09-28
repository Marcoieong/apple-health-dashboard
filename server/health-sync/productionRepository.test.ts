// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  NeonHealthSyncRepository,
  createHealthSyncCursor,
  createHealthSyncLockKey,
  mapPrivateHealthDay
} from './productionRepository.js';

describe('Health sync production mapping', () => {
  it('creates an opaque deterministic cursor scoped to owner and device', () => {
    const config = { cursorSecret: 'c'.repeat(32) };
    const cursor = createHealthSyncCursor(config, 'owner-a', 'device-a-12345678', 'sync-a');
    expect(cursor).toMatch(/^hsc1_[A-Za-z0-9_-]+$/);
    expect(createHealthSyncCursor(config, 'owner-a', 'device-a-12345678', 'sync-a')).toBe(cursor);
    expect(createHealthSyncCursor(config, 'owner-b', 'device-a-12345678', 'sync-a')).not.toBe(cursor);
  });

  it('creates an unambiguous PostgreSQL-safe advisory lock key', () => {
    const key = createHealthSyncLockKey('auth0|owner:1', 'sync-id');
    expect(key).toBe('["auth0|owner:1","sync-id"]');
    expect(key).not.toContain('\0');
    expect(JSON.parse(key)).toEqual(['auth0|owner:1', 'sync-id']);
  });

  it('uses PostgreSQL-safe lock and response parameters in a sync transaction', async () => {
    const statements: Array<{ statement: string; params: unknown[] }> = [];
    const requestDigest = 'digest';
    const serverTime = '2026-08-15T01:47:00.000Z';
    const sql = {
      transaction: async (
        build: (tx: {
          query: (statement: string, params: unknown[]) => unknown;
        }) => unknown[]
      ) =>
        build({
          query(statement, params) {
            statements.push({ statement, params });
            if (statement.includes('returning sync_id::text')) {
              return [{ sync_id: '00000000-0000-4000-8000-000000000001' }];
            }
            if (statement.includes('select request_digest, status')) {
              return [
                {
                  request_digest: requestDigest,
                  status: 'recorded',
                  response_snapshot: {
                    accepted_days: 1,
                    changed_days: 1,
                    cursor: 'hsc1_test',
                    server_time: serverTime
                  }
                }
              ];
            }
            return [];
          }
        })
    };
    const repository = new NeonHealthSyncRepository(
      sql as never,
      { cursorSecret: 'c'.repeat(32) }
    );

    await repository.applyOnce({
      ownerId: 'auth0|owner:1',
      requestDigest,
      serverTime,
      sync: {
        schema_version: 1,
        sync_id: '00000000-0000-4000-8000-000000000001',
        device_installation_id: 'device-installation-1',
        collected_at: serverTime,
        days: [
          {
            local_date: '2026-08-15',
            timezone: 'Asia/Macau',
            source_updated_at: serverTime,
            metrics: { steps: 1 }
          }
        ]
      }
    });

    expect(statements[1].params[0]).not.toContain('\0');
    const snapshotQuery = statements.find(({ statement }) =>
      statement.includes('response_snapshot = jsonb_build_object')
    );
    expect(snapshotQuery?.statement).toContain("'cursor', $4::text");
  });

  it('does not manufacture missing health values', () => {
    expect(
      mapPrivateHealthDay({
        local_date: '2026-08-05',
        timezone: 'Asia/Macau',
        steps: 8123,
        active_energy_kcal: null,
        exercise_minutes: null,
        sleep_hours: 7.25,
        weight_kg: null,
        body_fat_percent: null,
        source_updated_at: '2026-08-05T01:10:00.000Z'
      })
    ).toEqual({
      local_date: '2026-08-05',
      timezone: 'Asia/Macau',
      steps: 8123,
      sleep_hours: 7.25,
      source_updated_at: '2026-08-05T01:10:00.000Z'
    });
  });
});

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { HealthSyncInputV1 } from './contract.js';
import {
  applyHealthSync,
  HealthSyncConflictError,
  type HealthSyncRepository
} from './sync.js';

const sync: HealthSyncInputV1 = {
  schema_version: 1,
  sync_id: '0ad86f4e-a310-42f9-b329-08a831a415d4',
  device_installation_id: 'device_installation_01',
  collected_at: '2026-08-05T09:10:00+08:00',
  days: [
    {
      local_date: '2026-08-05',
      timezone: 'Asia/Macau',
      source_updated_at: '2026-08-05T09:09:00+08:00',
      metrics: { steps: 8123 }
    }
  ]
};

describe('Health sync orchestration', () => {
  it('returns an applied receipt without exposing health values', async () => {
    const repository: HealthSyncRepository = {
      applyOnce: async () => ({
        state: 'applied',
        acceptedDays: 1,
        changedDays: 1,
        cursor: 'cursor-2',
        serverTime: '2026-08-05T01:11:00.000Z'
      })
    };
    await expect(
      applyHealthSync('owner-1', sync, repository)
    ).resolves.toEqual({
      schema_version: 1,
      sync_id: sync.sync_id,
      status: 'applied',
      accepted_days: 1,
      changed_days: 1,
      cursor: 'cursor-2',
      server_time: '2026-08-05T01:11:00.000Z'
    });
  });

  it('fails closed when a sync id is reused with other content', async () => {
    const repository: HealthSyncRepository = {
      applyOnce: async () => ({
        state: 'digest_conflict',
        acceptedDays: 0,
        changedDays: 0,
        cursor: '',
        serverTime: '2026-08-05T01:11:00.000Z'
      })
    };
    await expect(applyHealthSync('owner-1', sync, repository)).rejects.toBeInstanceOf(
      HealthSyncConflictError
    );
  });
});

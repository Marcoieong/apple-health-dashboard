// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  createHealthSyncCursor,
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

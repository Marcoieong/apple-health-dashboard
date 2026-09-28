// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  digestHealthSyncInput,
  healthSyncInputSchema,
  parseHealthSyncInput,
  type HealthSyncInputV1
} from './contract.js';

const validInput: HealthSyncInputV1 = {
  schema_version: 1,
  sync_id: '0ad86f4e-a310-42f9-b329-08a831a415d4',
  device_installation_id: 'device_installation_01',
  collected_at: '2026-08-05T09:10:00+08:00',
  days: [
    {
      local_date: '2026-08-05',
      timezone: 'Asia/Macau',
      source_updated_at: '2026-08-05T09:09:00+08:00',
      metrics: { steps: 8123, sleep_hours: 7.25 }
    }
  ]
};

describe('Health sync v1 contract', () => {
  it('accepts aggregate-only data and strips nothing implicitly', () => {
    expect(parseHealthSyncInput(validInput)).toEqual(validInput);
  });

  it.each([
    ['invalid calendar date', { days: [{ ...validInput.days[0], local_date: '2026-02-31' }] }],
    ['invalid timezone', { days: [{ ...validInput.days[0], timezone: 'Macau/Unknown' }] }],
    ['empty metrics', { days: [{ ...validInput.days[0], metrics: {} }] }],
    ['unknown raw sample field', { days: [{ ...validInput.days[0], metrics: { steps: 1 }, samples: [] }] }],
    ['null metric', { days: [{ ...validInput.days[0], metrics: { steps: null } }] }]
  ])('rejects %s', (_label, patch) => {
    expect(
      healthSyncInputSchema.safeParse({ ...validInput, ...patch }).success
    ).toBe(false);
  });

  it('rejects duplicate dates and batches over 31 days', () => {
    expect(
      healthSyncInputSchema.safeParse({
        ...validInput,
        days: [validInput.days[0], validInput.days[0]]
      }).success
    ).toBe(false);
    expect(
      healthSyncInputSchema.safeParse({
        ...validInput,
        days: Array.from({ length: 32 }, (_, index) => ({
          ...validInput.days[0],
          local_date: new Date(Date.UTC(2026, 6, index + 1))
            .toISOString()
            .slice(0, 10)
        }))
      }).success
    ).toBe(false);
  });

  it('produces a stable digest regardless of object key order', () => {
    const reordered = {
      days: validInput.days,
      collected_at: validInput.collected_at,
      device_installation_id: validInput.device_installation_id,
      sync_id: validInput.sync_id,
      schema_version: validInput.schema_version
    } as HealthSyncInputV1;
    expect(digestHealthSyncInput(reordered)).toBe(
      digestHealthSyncInput(validInput)
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { PrivateHealthDayV1 } from '../health-sync/contract.js';
import {
  getHealthSummary,
  getHealthSyncSummary,
  healthSummaryOutputSchema,
  healthSummaryToolDescriptor,
  healthSyncStatusOutputSchema,
  type HealthReadDependencies
} from './healthReadTools.js';

function dependencies(
  days: PrivateHealthDayV1[] = [],
  statuses: Awaited<ReturnType<HealthReadDependencies['listSyncStatus']>> = []
): HealthReadDependencies {
  return {
    listDays: vi.fn().mockResolvedValue(days),
    listSyncStatus: vi.fn().mockResolvedValue(statuses),
    now: () => new Date('2026-08-05T04:00:00.000Z')
  };
}

describe('ChatGPT read-only health tools', () => {
  it('returns a Macau date range, daily values and missing-aware averages', async () => {
    const deps = dependencies([
      {
        local_date: '2026-08-04',
        timezone: 'Asia/Macau',
        source_updated_at: '2026-08-04T15:00:00.000Z',
        steps: 8_000,
        sleep_hours: 7,
        weight_kg: 98
      },
      {
        local_date: '2026-08-05',
        timezone: 'Asia/Macau',
        source_updated_at: '2026-08-05T03:00:00.000Z',
        steps: 10_000,
        active_energy_kcal: 600,
        body_fat_percent: 32.5
      }
    ]);

    const summary = await getHealthSummary('owner-a', 7, deps);

    expect(deps.listDays).toHaveBeenCalledWith(
      'owner-a',
      '2026-07-30',
      '2026-08-05'
    );
    expect(summary.averages).toEqual({
      steps: 9_000,
      active_energy_kcal: 600,
      sleep_hours: 7,
      weight_kg: 98,
      body_fat_percent: 32.5
    });
    expect(summary.latest_measurements).toEqual({
      weight_kg: 98,
      body_fat_percent: 32.5
    });
    expect(summary.daily[0]).not.toHaveProperty('source_updated_at');
    expect(summary.daily[0]).not.toHaveProperty('timezone');
    expect(healthSummaryOutputSchema.parse(summary)).toEqual(summary);
  });

  it('keeps real zero values and never turns missing data into zero', async () => {
    const summary = await getHealthSummary(
      'owner-a',
      1,
      dependencies([
        {
          local_date: '2026-08-05',
          timezone: 'Asia/Macau',
          source_updated_at: '2026-08-05T03:00:00.000Z',
          steps: 0
        }
      ])
    );

    expect(summary.averages).toEqual({ steps: 0 });
    expect(summary.daily).toEqual([{ local_date: '2026-08-05', steps: 0 }]);
    expect(summary.latest_measurements).toEqual({});
  });

  it('returns a valid empty state when Apple Health has not synced data', async () => {
    const summary = await getHealthSummary('owner-a', 31, dependencies());

    expect(summary.days_with_data).toBe(0);
    expect(summary.daily).toEqual([]);
    expect(summary.averages).toEqual({});
    expect(healthSummaryOutputSchema.parse(summary)).toEqual(summary);
  });

  it('summarizes sync timestamps without exposing device identifiers', async () => {
    const summary = await getHealthSyncSummary(
      'owner-a',
      dependencies([], [
        {
          deviceInstallationId: 'private-device-one',
          lastCollectedAt: '2026-08-05T01:00:00.000Z',
          lastSyncAt: '2026-08-05T01:02:00.000Z'
        },
        {
          deviceInstallationId: 'private-device-two',
          lastCollectedAt: '2026-08-05T02:00:00.000Z',
          lastSyncAt: '2026-08-05T02:03:00.000Z'
        }
      ])
    );

    expect(summary).toEqual({
      connected_device_count: 2,
      latest_sync_at: '2026-08-05T02:03:00.000Z',
      latest_collected_at: '2026-08-05T02:00:00.000Z',
      status: 'synced'
    });
    expect(JSON.stringify(summary)).not.toContain('private-device');
    expect(healthSyncStatusOutputSchema.parse(summary)).toEqual(summary);
  });

  it('declares the summary tool read-only and closed-world', () => {
    expect(healthSummaryToolDescriptor.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    });
    expect(healthSummaryToolDescriptor._meta.securitySchemes).toEqual([
      { type: 'oauth2', scopes: ['health.read'] }
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  parsePrivateHealthResponse,
  parsePrivateHealthSyncStatus
} from './privateHealth';

describe('private health response', () => {
  it('maps only approved HealthKit aggregates', () => {
    const records = parsePrivateHealthResponse({
      range: { from: '2026-08-04', to: '2026-08-05' },
      days: [
        {
          local_date: '2026-08-05',
          timezone: 'Asia/Macau',
          source_updated_at: '2026-08-05T10:00:00.000Z',
          steps: 9_876,
          active_energy_kcal: 543.2,
          sleep_hours: 7.5
        }
      ]
    });

    expect(records).toEqual([
      {
        id: 'healthkit-2026-08-05',
        date: '2026-08-05',
        steps: 9_876,
        activeCalories: 543.2,
        sleepHours: 7.5,
        source: 'healthkit',
        createdAt: '2026-08-05T10:00:00.000Z',
        updatedAt: '2026-08-05T10:00:00.000Z'
      }
    ]);
  });

  it('preserves zero values instead of treating them as missing', () => {
    expect(
      parsePrivateHealthResponse({
        days: [
          {
            local_date: '2026-08-05',
            timezone: 'Asia/Macau',
            source_updated_at: '2026-08-05T10:00:00Z',
            steps: 0,
            exercise_minutes: 0
          }
        ]
      })[0]
    ).toMatchObject({ steps: 0, exerciseMinutes: 0 });
  });

  it('fails closed on malformed data', () => {
    expect(() =>
      parsePrivateHealthResponse({
        days: [{ local_date: '05/08/2026', timezone: 'Asia/Macau' }]
      })
    ).toThrow('私人健康資料格式不正確');
  });
});

describe('private health sync status', () => {
  it('summarizes devices without exposing their identifiers', () => {
    const status = parsePrivateHealthSyncStatus({
      devices: [
        {
          deviceInstallationId: 'private-device-a',
          lastCollectedAt: '2026-08-05T09:00:00Z',
          lastSyncAt: '2026-08-05T09:02:00Z'
        },
        {
          deviceInstallationId: 'private-device-b',
          lastCollectedAt: '2026-08-05T10:00:00Z',
          lastSyncAt: '2026-08-05T10:01:00Z'
        }
      ]
    });

    expect(status).toEqual({
      deviceCount: 2,
      latestCollectedAt: '2026-08-05T10:00:00Z',
      latestSyncAt: '2026-08-05T10:01:00Z'
    });
    expect(JSON.stringify(status)).not.toContain('private-device');
  });
});

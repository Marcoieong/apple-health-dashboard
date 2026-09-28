import { describe, expect, it } from 'vitest';
import type { PrivateHealthDayV1 } from '../health-sync/contract.js';
import { boardDateRange, buildFamilyBoardMember } from './board.js';

const healthDay: PrivateHealthDayV1 = {
  local_date: '2026-08-16',
  timezone: 'Asia/Macau',
  steps: 10_200,
  active_energy_kcal: 560,
  exercise_minutes: 35,
  sleep_hours: 7.4,
  weight_kg: 98,
  body_fat_percent: 33,
  source_updated_at: '2026-08-16T02:00:00.000Z'
};

describe('family board response boundary', () => {
  it('returns only the explicitly shared activity summary', () => {
    const member = buildFamilyBoardMember({
      ownerId: 'bob',
      memberId: '43386bd0-c91d-47c4-98a8-38da646a86f5',
      displayName: 'Bob',
      isCurrentUser: false,
      viewerOwnerId: 'alice',
      grants: [
        { subjectOwnerId: 'bob', viewerOwnerId: 'alice', scope: 'activity_status' }
      ],
      days: [healthDay]
    });

    expect(member?.metrics.steps.status).toBe('met');
    expect(member?.metrics.exercise.status).toBe('close');
    expect(member?.metrics.sleep.status).toBe('unavailable');
    expect(member?.weeklyDirection).toBe('unknown');
    expect(member?.advice).toBe('未分享今日建議。');
    expect(member).not.toHaveProperty('weightKg');
    expect(member).not.toHaveProperty('bodyFatPercent');
  });

  it('returns no member at all when another account has no grants', () => {
    expect(buildFamilyBoardMember({
      ownerId: 'bob',
      memberId: '8197b81d-e8b0-49a5-8081-76e7888013ad',
      displayName: 'Bob',
      isCurrentUser: false,
      viewerOwnerId: 'carol',
      grants: [],
      days: [healthDay]
    })).toBeUndefined();
  });

  it('uses an inclusive fourteen-day query window', () => {
    expect(boardDateRange('2026-08-16')).toEqual({
      from: '2026-08-03',
      to: '2026-08-16'
    });
  });
});

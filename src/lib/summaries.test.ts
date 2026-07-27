import { describe, expect, it } from 'vitest';
import { createDemoRecords } from '../data/demoRecords';
import { calculateDailyScore } from './scoring';
import { calculateMonthlySummary, calculateWeeklySummary } from './summaries';

describe('週與月匯總', () => {
  const records = createDemoRecords('2026-07-27');

  it('以最近七日計算本週平均和上週差異', () => {
    const current = records.slice(-7);
    const previous = records.slice(0, 7);
    const summary = calculateWeeklySummary(current, previous);
    const expectedAverage =
      Math.round(
        (current.reduce(
          (sum, record) => sum + calculateDailyScore(record).total,
          0
        ) /
          7) *
          10
      ) / 10;

    expect(summary.records).toHaveLength(7);
    expect(summary.averageScore).toBe(expectedAverage);
    expect(summary.previousAverageScore).not.toBeNull();
    expect(summary.scoreChange).not.toBeNull();
    expect(summary.mainBottleneck.length).toBeGreaterThan(0);
  });

  it('計算月初、月末與各項月度變化', () => {
    const summary = calculateMonthlySummary(records, '2026-07');

    expect(summary.records).toHaveLength(14);
    expect(summary.startWeightKg).toBe(98.6);
    expect(summary.endWeightKg).toBe(97.5);
    expect(summary.weightChangeKg).toBe(-1.1);
    expect(summary.bodyFatChangePercent).toBe(-0.9);
    expect(summary.waistChangeCm).toBe(-1.4);
    expect(summary.nextPriorities).toHaveLength(3);
  });

  it('空月份回傳可安全顯示的空狀態', () => {
    const summary = calculateMonthlySummary(records, '2025-01');
    expect(summary.records).toHaveLength(0);
    expect(summary.achievementRate).toBeNull();
    expect(summary.summary).toBe('本月尚未有紀錄。');
  });
});

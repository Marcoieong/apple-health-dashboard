import { describe, expect, it } from 'vitest';
import type { DailyHealthRecord } from '../models/health';
import {
  calculateDailyScore,
  getRating,
  scoreActiveCalories,
  scoreExerciseMinutes,
  scoreSleep,
  scoreSteps
} from './scoring';

describe('每日健康評分', () => {
  it.each([
    [399, 5],
    [400, 15],
    [500, 20],
    [600, 22],
    [700, 25]
  ])('活動卡路里 %s 得 %s 分', (value, expected) => {
    expect(scoreActiveCalories(value)).toBe(expected);
  });

  it.each([
    [7_999, 5],
    [8_000, 12],
    [9_000, 16],
    [10_000, 18],
    [12_000, 20]
  ])('步數 %s 得 %s 分', (value, expected) => {
    expect(scoreSteps(value)).toBe(expected);
  });

  it.each([
    [19, 3],
    [20, 8],
    [30, 12],
    [45, 15]
  ])('運動分鐘 %s 得 %s 分', (value, expected) => {
    expect(scoreExerciseMinutes(value)).toBe(expected);
  });

  it.each([
    [5.99, 3],
    [6, 8],
    [6.49, 8],
    [6.5, 12],
    [6.99, 12],
    [7, 15],
    [8.5, 15],
    [8.51, 12],
    [9, 12],
    [9.01, 8]
  ])('睡眠 %s 小時得 %s 分', (value, expected) => {
    expect(scoreSleep(value)).toBe(expected);
  });

  it('缺少欄位不會暗中給最低分，並會列為不完整', () => {
    const result = calculateDailyScore({ steps: 9_000 });
    expect(result.total).toBe(16);
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toContain('activeCalories');
  });

  it('滿分紀錄為 100 分 Excellent', () => {
    const record: Partial<DailyHealthRecord> = {
      activeCalories: 700,
      steps: 12_000,
      exerciseMinutes: 45,
      sleepHours: 8,
      lunchHighProtein: true,
      dinnerHighProtein: true,
      vegetablesCompleted: true,
      noSugaryDrink: true,
      noLateNightMeal: true
    };
    expect(calculateDailyScore(record)).toMatchObject({
      total: 100,
      rating: 'Excellent',
      isComplete: true
    });
  });

  it('完整的最低區間紀錄為 16 分 Reset Tomorrow', () => {
    const record: Partial<DailyHealthRecord> = {
      activeCalories: 0,
      steps: 0,
      exerciseMinutes: 0,
      sleepHours: 0,
      lunchHighProtein: false,
      dinnerHighProtein: false,
      vegetablesCompleted: false,
      noSugaryDrink: false,
      noLateNightMeal: false
    };
    expect(calculateDailyScore(record)).toMatchObject({
      total: 16,
      rating: 'Reset Tomorrow',
      isComplete: true
    });
  });

  it.each([
    [90, 'Excellent'],
    [80, 'Very Good'],
    [70, 'Good'],
    [60, 'Needs Improvement'],
    [59, 'Reset Tomorrow']
  ])('總分 %s 的評級為 %s', (score, rating) => {
    expect(getRating(score)).toBe(rating);
  });
});

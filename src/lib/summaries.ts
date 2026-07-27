import { healthTargets } from '../data/healthTargets';
import type {
  DailyHealthRecord,
  MonthlySummary,
  TrendDirection,
  WeeklySummary
} from '../models/health';
import { calculateDailyScore } from './scoring';

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(
  records: DailyHealthRecord[],
  getValue: (record: DailyHealthRecord) => number | undefined
): number | null {
  const values = records.map(getValue).filter((value): value is number => value !== undefined);
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function changeBetween(
  records: DailyHealthRecord[],
  getValue: (record: DailyHealthRecord) => number | undefined
): number | null {
  const values = records.map(getValue).filter((value): value is number => value !== undefined);
  return values.length >= 2 ? round(values.at(-1)! - values[0]) : null;
}

function mealCompletion(record: DailyHealthRecord): number | null {
  const values = [
    record.lunchHighProtein,
    record.dinnerHighProtein,
    record.vegetablesCompleted,
    record.noSugaryDrink,
    record.noLateNightMeal
  ].filter((value): value is boolean => value !== undefined);
  return values.length ? values.filter(Boolean).length / values.length : null;
}

function trend(change: number | null): TrendDirection {
  if (change === null) return 'insufficient-data';
  if (Math.abs(change) < 0.05) return 'flat';
  return change > 0 ? 'up' : 'down';
}

function bottleneck(records: DailyHealthRecord[]): string {
  if (!records.length) return '尚未有足夠資料';
  const ratios = [
    {
      label: '步數',
      value: (average(records, (record) => record.steps) ?? 0) / healthTargets.steps.minimum
    },
    {
      label: '活動卡路里',
      value:
        (average(records, (record) => record.activeCalories) ?? 0) /
        healthTargets.activeCalories.minimum
    },
    {
      label: '運動時間',
      value:
        (average(records, (record) => record.exerciseMinutes) ?? 0) /
        healthTargets.exerciseMinutes.minimum
    },
    {
      label: '睡眠',
      value:
        (average(records, (record) => record.sleepHours) ?? 0) /
        healthTargets.sleepHours.minimum
    },
    {
      label: '健康飲食',
      value:
        (average(records, (record) => {
          const rate = mealCompletion(record);
          return rate === null ? undefined : rate;
        }) ?? 0) / healthTargets.healthyMealRate
    }
  ];
  ratios.sort((a, b) => a.value - b.value);
  return ratios[0].value >= 1 ? '主要目標整體達標' : `${ratios[0].label}仍是本週主要瓶頸`;
}

export function calculateWeeklySummary(
  records: DailyHealthRecord[],
  previousRecords: DailyHealthRecord[] = []
): WeeklySummary {
  const current = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const previous = [...previousRecords].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const averageScore = average(current, (record) => calculateDailyScore(record).total);
  const previousAverageScore = average(previous, (record) => calculateDailyScore(record).total);
  const scoreChange =
    averageScore !== null && previousAverageScore !== null
      ? round(averageScore - previousAverageScore)
      : null;
  const mealRates = current.map(mealCompletion).filter((value): value is number => value !== null);

  return {
    startDate: current[0]?.date,
    endDate: current.at(-1)?.date,
    averageScore,
    previousAverageScore,
    scoreChange,
    scoreDirection: trend(scoreChange),
    averageSteps: average(current, (record) => record.steps),
    averageActiveCalories: average(current, (record) => record.activeCalories),
    averageExerciseMinutes: average(current, (record) => record.exerciseMinutes),
    averageSleepHours: average(current, (record) => record.sleepHours),
    weightChangeKg: changeBetween(current, (record) => record.weightKg),
    healthyMealRate: mealRates.length
      ? round(mealRates.reduce((sum, value) => sum + value, 0) / mealRates.length, 2)
      : null,
    strengthTrainingCount: current.filter((record) => record.strengthTraining).length,
    achievedDays: current.filter((record) => calculateDailyScore(record).total >= 80).length,
    mainBottleneck: bottleneck(current),
    records: current
  };
}

export function calculateMonthlySummary(
  allRecords: DailyHealthRecord[],
  month: string
): MonthlySummary {
  const records = allRecords
    .filter((record) => record.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const mealRates = records.map(mealCompletion).filter((value): value is number => value !== null);
  const achievementRate = records.length
    ? round(
        records.filter((record) => calculateDailyScore(record).total >= 80).length /
          records.length,
        2
      )
    : null;
  const averageSteps = average(records, (record) => record.steps);
  const averageSleepHours = average(records, (record) => record.sleepHours);
  const strengthTrainingCount = records.filter((record) => record.strengthTraining).length;
  const nextPriorities = [
    (averageSteps ?? 0) < healthTargets.steps.minimum
      ? `把日均步數提升至 ${healthTargets.steps.minimum.toLocaleString()} 步`
      : '維持目前步行節奏',
    (averageSleepHours ?? 0) < healthTargets.sleepHours.minimum
      ? `把平均睡眠提升至 ${healthTargets.sleepHours.minimum} 小時`
      : '維持穩定睡眠時段',
    strengthTrainingCount < healthTargets.strengthTrainingPerWeek * 4
      ? `每週完成 ${healthTargets.strengthTrainingPerWeek} 次力量訓練`
      : '維持力量訓練並安排恢復'
  ];

  return {
    month,
    startWeightKg: records.find((record) => record.weightKg !== undefined)?.weightKg ?? null,
    endWeightKg: [...records].reverse().find((record) => record.weightKg !== undefined)?.weightKg ?? null,
    weightChangeKg: changeBetween(records, (record) => record.weightKg),
    bodyFatChangePercent: changeBetween(records, (record) => record.bodyFatPercent),
    waistChangeCm: changeBetween(records, (record) => record.waistCm),
    averageSteps,
    averageActiveCalories: average(records, (record) => record.activeCalories),
    averageSleepHours,
    strengthTrainingCount,
    healthyMealRate: mealRates.length
      ? round(mealRates.reduce((sum, value) => sum + value, 0) / mealRates.length, 2)
      : null,
    achievementRate,
    summary: !records.length
      ? '本月尚未有紀錄。'
      : achievementRate !== null && achievementRate >= 0.7
        ? '本月習慣維持穩定，下一步以持續性為先。'
        : `${bottleneck(records)}，下月先專注最容易執行的改善。`,
    nextPriorities,
    records
  };
}


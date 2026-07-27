import type { DailyHealthRecord } from '../models/health';
import { addDays, todayKey } from '../lib/date';

const demoValues = [
  [7420, 520, 15, 6.4, 98.6, 33.5, 108.2],
  [8130, 548, 22, 7.1, 98.4, 33.4, 108.1],
  [6850, 472, 12, 6.7, 98.5, 33.5, 108.2],
  [9240, 612, 31, 7.5, 98.2, 33.2, 107.8],
  [10120, 645, 42, 7.2, 98.0, 33.1, 107.7],
  [7560, 535, 18, 6.8, 98.1, 33.2, 107.7],
  [8840, 590, 26, 7.4, 97.9, 33.0, 107.5],
  [6320, 448, 10, 6.1, 98.0, 33.0, 107.6],
  [7950, 558, 17, 7.0, 97.8, 32.9, 107.4],
  [8460, 575, 20, 7.3, 97.7, 32.8, 107.3],
  [11240, 710, 48, 8.0, 97.5, 32.7, 107.0],
  [7890, 540, 16, 6.6, 97.6, 32.7, 107.0],
  [9360, 625, 33, 7.6, 97.4, 32.6, 106.8],
  [5660, 486, 15, 6.75, 97.5, 32.6, 106.8]
] as const;

export function createDemoRecords(endDate = todayKey()): DailyHealthRecord[] {
  const now = new Date().toISOString();
  return demoValues.map((values, index) => {
    const [
      steps,
      activeCalories,
      exerciseMinutes,
      sleepHours,
      weightKg,
      bodyFatPercent,
      waistCm
    ] = values;
    return {
      id: `demo-${index + 1}`,
      date: addDays(endDate, index - demoValues.length + 1),
      steps,
      activeCalories,
      exerciseMinutes,
      sleepHours,
      weightKg,
      bodyFatPercent,
      waistCm,
      strengthTraining: [1, 4, 8, 10, 12].includes(index),
      lunchHighProtein: index % 4 !== 0,
      dinnerHighProtein: index % 3 !== 0,
      vegetablesCompleted: index % 5 !== 0,
      noSugaryDrink: index % 4 !== 1,
      noLateNightMeal: index % 6 !== 0,
      notes: '',
      source: 'demo',
      createdAt: now,
      updatedAt: now
    };
  });
}


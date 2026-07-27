import type {
  DailyHealthRecord,
  DailyScoreResult,
  ScoreRating
} from '../models/health';

export function scoreActiveCalories(value?: number): number {
  if (value === undefined) return 0;
  if (value >= 700) return 25;
  if (value >= 600) return 22;
  if (value >= 500) return 20;
  if (value >= 400) return 15;
  return 5;
}

export function scoreSteps(value?: number): number {
  if (value === undefined) return 0;
  if (value >= 12_000) return 20;
  if (value >= 10_000) return 18;
  if (value >= 9_000) return 16;
  if (value >= 8_000) return 12;
  return 5;
}

export function scoreExerciseMinutes(value?: number): number {
  if (value === undefined) return 0;
  if (value >= 45) return 15;
  if (value >= 30) return 12;
  if (value >= 20) return 8;
  return 3;
}

export function scoreSleep(value?: number): number {
  if (value === undefined) return 0;
  if (value >= 7 && value <= 8.5) return 15;
  if ((value >= 6.5 && value < 7) || (value > 8.5 && value <= 9)) return 12;
  if ((value >= 6 && value < 6.5) || value > 9) return 8;
  return 3;
}

export function getRating(total: number): ScoreRating {
  if (total >= 90) return 'Excellent';
  if (total >= 80) return 'Very Good';
  if (total >= 70) return 'Good';
  if (total >= 60) return 'Needs Improvement';
  return 'Reset Tomorrow';
}

export function calculateDailyScore(
  record: Partial<DailyHealthRecord>
): DailyScoreResult {
  const nutritionFields = [
    'lunchHighProtein',
    'dinnerHighProtein',
    'vegetablesCompleted',
    'noSugaryDrink',
    'noLateNightMeal'
  ] as const;
  const nutrition = nutritionFields.reduce(
    (total, field) => total + (record[field] === true ? 5 : 0),
    0
  );
  const components = {
    activeCalories: scoreActiveCalories(record.activeCalories),
    steps: scoreSteps(record.steps),
    exerciseMinutes: scoreExerciseMinutes(record.exerciseMinutes),
    nutrition,
    sleep: scoreSleep(record.sleepHours)
  };
  const requiredFields = [
    'activeCalories',
    'steps',
    'exerciseMinutes',
    'sleepHours',
    ...nutritionFields
  ] as const;
  const missingFields = requiredFields.filter(
    (field) => record[field] === undefined
  );
  const total = Object.values(components).reduce((sum, value) => sum + value, 0);

  return {
    total,
    rating: getRating(total),
    components,
    missingFields,
    isComplete: missingFields.length === 0
  };
}


export interface DailyHealthRecord {
  id: string;
  date: string;
  steps?: number;
  activeCalories?: number;
  exerciseMinutes?: number;
  sleepHours?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  strengthTraining?: boolean;
  lunchHighProtein?: boolean;
  dinnerHighProtein?: boolean;
  vegetablesCompleted?: boolean;
  noSugaryDrink?: boolean;
  noLateNightMeal?: boolean;
  notes?: string;
  source?: 'demo' | 'manual' | 'imported';
  createdAt: string;
  updatedAt: string;
}

export interface HealthTargets {
  activeCalories: {
    minimum: number;
    preferred: number;
    upperTarget: number;
  };
  steps: {
    minimum: number;
    preferred: number;
  };
  exerciseMinutes: {
    minimum: number;
    preferred: number;
  };
  sleepHours: {
    minimum: number;
    upperTarget: number;
  };
  strengthTrainingPerWeek: number;
  healthyMealRate: number;
  weeklyWeightLossKg: {
    minimum: number;
    maximum: number;
  };
}

export type ScoreRating =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Needs Improvement'
  | 'Reset Tomorrow';

export interface DailyScoreResult {
  total: number;
  rating: ScoreRating;
  components: {
    activeCalories: number;
    steps: number;
    exerciseMinutes: number;
    nutrition: number;
    sleep: number;
  };
  missingFields: string[];
  isComplete: boolean;
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'insufficient-data';

export interface WeeklySummary {
  startDate?: string;
  endDate?: string;
  averageScore: number | null;
  previousAverageScore: number | null;
  scoreChange: number | null;
  scoreDirection: TrendDirection;
  averageSteps: number | null;
  averageActiveCalories: number | null;
  averageExerciseMinutes: number | null;
  averageSleepHours: number | null;
  weightChangeKg: number | null;
  healthyMealRate: number | null;
  strengthTrainingCount: number;
  achievedDays: number;
  mainBottleneck: string;
  records: DailyHealthRecord[];
}

export interface MonthlySummary {
  month: string;
  startWeightKg: number | null;
  endWeightKg: number | null;
  weightChangeKg: number | null;
  bodyFatChangePercent: number | null;
  waistChangeCm: number | null;
  averageSteps: number | null;
  averageActiveCalories: number | null;
  averageSleepHours: number | null;
  strengthTrainingCount: number;
  healthyMealRate: number | null;
  achievementRate: number | null;
  summary: string;
  nextPriorities: string[];
  records: DailyHealthRecord[];
}

export interface DataImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  records: DailyHealthRecord[];
}

export type HealthRecordInput = Omit<
  DailyHealthRecord,
  'id' | 'createdAt' | 'updatedAt' | 'source'
>;


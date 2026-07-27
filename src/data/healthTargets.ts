import type { HealthTargets } from '../models/health';

export const healthTargets: HealthTargets = {
  activeCalories: {
    minimum: 500,
    preferred: 550,
    upperTarget: 700
  },
  steps: {
    minimum: 9000,
    preferred: 10000
  },
  exerciseMinutes: {
    minimum: 30,
    preferred: 45
  },
  sleepHours: {
    minimum: 7,
    upperTarget: 9
  },
  strengthTrainingPerWeek: 3,
  healthyMealRate: 0.8,
  weeklyWeightLossKg: {
    minimum: 0.25,
    maximum: 0.75
  }
};


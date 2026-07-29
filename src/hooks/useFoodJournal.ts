import { useCallback, useMemo, useState } from 'react';
import { createDemoMealEntries } from '../data/demoMealEntries';
import type {
  FoodJournalEntry,
  MealType
} from '../models/foodJournal';

type PrivateViewStatus = 'locked' | 'loading' | 'unlocked' | 'error';

interface PrivateMealResponse {
  id: string;
  localDate: string;
  timezone: string;
  mealType: MealType;
  foodLabels: string[];
  preparationMethods: string[];
  notes?: string;
  source: 'chatgpt' | 'shortcut';
  photoCount: number;
  recordedAt: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPrivateMeal(value: unknown): value is PrivateMealResponse {
  if (!value || typeof value !== 'object') return false;
  const meal = value as Partial<PrivateMealResponse>;
  return (
    typeof meal.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(meal.localDate ?? '') &&
    typeof meal.timezone === 'string' &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.mealType ?? '') &&
    isStringArray(meal.foodLabels) &&
    isStringArray(meal.preparationMethods) &&
    (meal.notes === undefined || typeof meal.notes === 'string') &&
    (meal.source === 'chatgpt' || meal.source === 'shortcut') &&
    Number.isInteger(meal.photoCount) &&
    (meal.photoCount ?? -1) >= 0 &&
    typeof meal.recordedAt === 'string'
  );
}

function toJournalEntry(meal: PrivateMealResponse): FoodJournalEntry {
  return {
    id: meal.id,
    localDate: meal.localDate,
    timezone: meal.timezone,
    mealType: meal.mealType,
    foods: meal.foodLabels,
    cookingMethods: meal.preparationMethods,
    ...(meal.notes ? { notes: meal.notes } : {}),
    recordedAt: meal.recordedAt,
    privatePhotoCount: meal.photoCount,
    photo: {
      kind: 'placeholder',
      alt: `${meal.localDate} 私人餐食相片已安全保存，未在公開頁載入`
    },
    source: meal.source
  };
}

export function useFoodJournal() {
  const demoEntries = useMemo(() => createDemoMealEntries(), []);
  const [privateEntries, setPrivateEntries] = useState<FoodJournalEntry[]>([]);
  const [status, setStatus] = useState<PrivateViewStatus>('locked');
  const [error, setError] = useState<string>();

  const unlock = useCallback(async (accessCode: string) => {
    setStatus('loading');
    setError(undefined);
    try {
      const response = await fetch('/api/private/meals', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessCode}`
        }
      });
      if (response.status === 401) {
        throw new Error('存取碼不正確，請重新輸入。');
      }
      if (!response.ok) {
        throw new Error('暫時未能載入私人紀錄，請稍後再試。');
      }
      const body: unknown = await response.json();
      const meals =
        body && typeof body === 'object' && 'meals' in body
          ? (body as { meals?: unknown }).meals
          : undefined;
      if (!Array.isArray(meals) || !meals.every(isPrivateMeal)) {
        throw new Error('私人紀錄格式不正確，已停止載入。');
      }
      setPrivateEntries(meals.map(toJournalEntry));
      setStatus('unlocked');
    } catch (reason) {
      setPrivateEntries([]);
      setStatus('error');
      setError(
        reason instanceof Error
          ? reason.message
          : '暫時未能載入私人紀錄，請稍後再試。'
      );
    }
  }, []);

  const lock = useCallback(() => {
    setPrivateEntries([]);
    setError(undefined);
    setStatus('locked');
  }, []);

  return {
    entries: status === 'unlocked' ? privateEntries : demoEntries,
    isReadOnly: true as const,
    mode: status === 'unlocked' ? ('private' as const) : ('demo' as const),
    status,
    error,
    unlock,
    lock
  };
}

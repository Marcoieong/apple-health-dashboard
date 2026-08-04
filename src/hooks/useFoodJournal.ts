import { useCallback, useEffect, useMemo, useState } from 'react';
import { createDemoMealEntries } from '../data/demoMealEntries';
import type { FoodJournalEntry, MealType } from '../models/foodJournal';

export type FamilyViewStatus =
  | 'checking'
  | 'signed-out'
  | 'loading'
  | 'authenticated'
  | 'error';

export interface FamilyMember {
  email: string;
  name?: string;
  isAdmin: boolean;
}

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
  thumbnail?: { url: string; width: number; height: number };
  recordedAt: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isThumbnail(value: unknown): value is NonNullable<PrivateMealResponse['thumbnail']> {
  if (!value || typeof value !== 'object') return false;
  const thumbnail = value as Record<string, unknown>;
  return (
    typeof thumbnail.url === 'string' &&
    thumbnail.url.startsWith('/api/private/photo?token=') &&
    Number.isInteger(thumbnail.width) &&
    Number(thumbnail.width) > 0 &&
    Number.isInteger(thumbnail.height) &&
    Number(thumbnail.height) > 0
  );
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
    (meal.thumbnail === undefined || isThumbnail(meal.thumbnail)) &&
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
    photo: meal.thumbnail
      ? {
          kind: 'authenticated-thumbnail',
          src: meal.thumbnail.url as `/api/${string}`,
          alt: `${meal.localDate} ${meal.foodLabels.join('、')}餐食相片`,
          width: meal.thumbnail.width,
          height: meal.thumbnail.height
        }
      : {
          kind: 'placeholder',
          alt: `${meal.localDate} 餐食沒有可顯示的縮圖`
        },
    source: meal.source
  };
}

function parseMember(value: unknown): FamilyMember | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const member = value as Record<string, unknown>;
  if (typeof member.email !== 'string' || typeof member.isAdmin !== 'boolean') {
    return undefined;
  }
  return {
    email: member.email,
    ...(typeof member.name === 'string' ? { name: member.name } : {}),
    isAdmin: member.isAdmin
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('此預覽未連接家庭登入服務；請使用已部署的安全網址。');
  }
  return response.json() as Promise<unknown>;
}

export function useFoodJournal() {
  const demoEntries = useMemo(() => createDemoMealEntries(), []);
  const [privateEntries, setPrivateEntries] = useState<FoodJournalEntry[]>([]);
  const [member, setMember] = useState<FamilyMember>();
  const [status, setStatus] = useState<FamilyViewStatus>('checking');
  const [error, setError] = useState<string>();

  const loadPrivateMeals = useCallback(async () => {
    setStatus('loading');
    setError(undefined);
    const response = await fetch('/api/private/meals', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (response.status === 401) {
      setMember(undefined);
      setPrivateEntries([]);
      setStatus('signed-out');
      return;
    }
    if (!response.ok) throw new Error('暫時未能載入私人紀錄，請稍後再試。');
    const body = await readJsonResponse(response);
    const meals =
      body && typeof body === 'object' && 'meals' in body
        ? (body as { meals?: unknown }).meals
        : undefined;
    if (!Array.isArray(meals) || !meals.every(isPrivateMeal)) {
      throw new Error('私人紀錄格式不正確，已停止載入。');
    }
    setPrivateEntries(meals.map(toJournalEntry));
    setStatus('authenticated');
  }, []);

  const initialize = useCallback(async () => {
    setStatus('checking');
    setError(undefined);
    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('登入服務暫時不可用。');
      const body = await readJsonResponse(response);
      const authenticated =
        body &&
        typeof body === 'object' &&
        (body as { authenticated?: unknown }).authenticated === true;
      const nextMember = authenticated
        ? parseMember((body as { member?: unknown }).member)
        : undefined;
      if (!nextMember) {
        setMember(undefined);
        setPrivateEntries([]);
        setStatus('signed-out');
        return;
      }
      setMember(nextMember);
      await loadPrivateMeals();
    } catch (reason) {
      setPrivateEntries([]);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '登入服務暫時不可用。');
    }
  }, [loadPrivateMeals]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const login = useCallback(() => {
    window.location.assign('/api/auth/login?returnTo=%2F%3Fsection%3Dfood-journal');
  }, []);

  const logout = useCallback(() => {
    window.location.assign('/api/auth/logout');
  }, []);

  return {
    entries: status === 'authenticated' ? privateEntries : demoEntries,
    isReadOnly: true as const,
    mode: status === 'authenticated' ? ('private' as const) : ('demo' as const),
    status,
    member,
    error,
    login,
    logout,
    retry: initialize,
    refresh: loadPrivateMeals
  };
}

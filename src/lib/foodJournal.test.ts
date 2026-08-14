import { describe, expect, it } from 'vitest';
import { createDemoMealEntries } from '../data/demoMealEntries';
import type { FoodJournalEntry } from '../models/foodJournal';
import {
  formatFoodJournalDate,
  formatMealTime,
  groupFoodJournalEntries
} from './foodJournal';

function entry(overrides: Partial<FoodJournalEntry> = {}): FoodJournalEntry {
  return {
    id: 'meal-1',
    localDate: '2026-08-15',
    timezone: 'Asia/Macau',
    mealType: 'lunch',
    foods: [],
    recordedAt: '2026-08-15T04:12:00.000Z',
    photo: { kind: 'placeholder', alt: '測試餐食' },
    source: 'shortcut',
    ...overrides
  };
}

describe('food journal time formatting', () => {
  it('displays a Macau Shortcut upload in Macau local time', () => {
    expect(formatMealTime(entry())).toBe('12:12');
  });

  it('corrects the legacy Shortcut UTC label to Macau display time', () => {
    expect(formatMealTime(entry({ timezone: 'UTC' }))).toBe('12:12');
  });

  it('falls back safely when a stored timezone is invalid', () => {
    expect(formatMealTime(entry({ timezone: 'not-a-timezone' }))).toBe('12:12');
  });

  it('keeps an explicit timezone for non-Shortcut records', () => {
    expect(
      formatMealTime(
        entry({ source: 'demo', timezone: 'UTC', occurredAt: '2026-08-15T04:12:00.000Z' })
      )
    ).toBe('04:12');
  });
});

describe('飲食日誌分組', () => {
  it('按日期倒序分組，並按餐別排序', () => {
    const entries = createDemoMealEntries('2026-07-28');
    const groups = groupFoodJournalEntries(entries);

    expect(groups.map((group) => group.date)).toEqual([
      '2026-07-28',
      '2026-07-27',
      '2026-07-26'
    ]);
    expect(groups[0].entries.map((item) => item.mealType)).toEqual([
      'breakfast',
      'dinner'
    ]);
  });

  it('同一公開紀錄 id 只顯示一次', () => {
    const entries = createDemoMealEntries('2026-07-28');
    const groups = groupFoodJournalEntries([...entries, entries[0]]);
    const visibleEntries = groups.flatMap((group) => group.entries);

    expect(visibleEntries).toHaveLength(entries.length);
  });

  it('辨識今日與昨日標籤', () => {
    expect(formatFoodJournalDate('2026-07-28', '2026-07-28')).toContain('今日');
    expect(formatFoodJournalDate('2026-07-27', '2026-07-28')).toContain('昨日');
  });
});

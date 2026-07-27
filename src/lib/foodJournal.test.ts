import { describe, expect, it } from 'vitest';
import { createDemoMealEntries } from '../data/demoMealEntries';
import { formatFoodJournalDate, groupFoodJournalEntries } from './foodJournal';

describe('飲食日誌分組', () => {
  it('按日期倒序分組，並按餐別排序', () => {
    const entries = createDemoMealEntries('2026-07-28');
    const groups = groupFoodJournalEntries(entries);

    expect(groups.map((group) => group.date)).toEqual([
      '2026-07-28',
      '2026-07-27',
      '2026-07-26'
    ]);
    expect(groups[0].entries.map((entry) => entry.mealType)).toEqual([
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

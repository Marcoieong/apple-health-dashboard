import { addDays, formatDateZh } from './date';
import type { FoodJournalEntry, MealType } from '../models/foodJournal';
import { DEFAULT_TIME_ZONE, resolveTimeZone } from './timezone';

export interface FoodJournalDay {
  date: string;
  entries: FoodJournalEntry[];
}

const mealTypeOrder: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3
};

function compareEntries(left: FoodJournalEntry, right: FoodJournalEntry) {
  return (
    mealTypeOrder[left.mealType] - mealTypeOrder[right.mealType] ||
    (left.occurredAt ?? left.recordedAt ?? '').localeCompare(
      right.occurredAt ?? right.recordedAt ?? ''
    )
  );
}

export function groupFoodJournalEntries(
  entries: readonly FoodJournalEntry[]
): FoodJournalDay[] {
  const seenIds = new Set<string>();
  const grouped = new Map<string, FoodJournalEntry[]>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);

    const dayEntries = grouped.get(entry.localDate) ?? [];
    dayEntries.push(entry);
    grouped.set(entry.localDate, dayEntries);
  }

  return [...grouped.entries()]
    .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
    .map(([date, dayEntries]) => ({
      date,
      entries: [...dayEntries].sort(compareEntries)
    }));
}

export function formatFoodJournalDate(date: string, today: string) {
  const formatted = formatDateZh(date);
  if (date === today) return `今日 · ${formatted}`;
  if (date === addDays(today, -1)) return `昨日 · ${formatted}`;
  return formatted;
}

export function formatMealTime(entry: FoodJournalEntry): string | undefined {
  const timestamp = entry.occurredAt ?? entry.recordedAt;
  if (!timestamp) return undefined;

  // Early iPhone Shortcut versions labelled the server write timestamp as
  // UTC. Those records were created in Macau and should be presented in the
  // user's local display timezone; new uploads already send Asia/Macau.
  const timeZone =
    entry.source === 'shortcut' && entry.timezone === 'UTC'
      ? DEFAULT_TIME_ZONE
      : resolveTimeZone(entry.timezone);

  return new Intl.DateTimeFormat('zh-Hant-MO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).format(new Date(timestamp));
}

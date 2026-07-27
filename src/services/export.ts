import type { DailyHealthRecord } from '../models/health';
import { exportRecords } from './storage';

function download(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(records: DailyHealthRecord[]) {
  download(exportRecords(records), 'health-records.json', 'application/json;charset=utf-8');
}

export function recordsToCsv(records: DailyHealthRecord[]) {
  const fields: (keyof DailyHealthRecord)[] = [
    'date', 'steps', 'activeCalories', 'exerciseMinutes', 'sleepHours',
    'weightKg', 'bodyFatPercent', 'waistCm', 'strengthTraining',
    'lunchHighProtein', 'dinnerHighProtein', 'vegetablesCompleted',
    'noSugaryDrink', 'noLateNightMeal', 'notes',
  ];
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [fields.map(quote).join(','), ...records.map((record) =>
    fields.map((field) => quote(record[field])).join(','))].join('\n');
}

export function downloadCsv(records: DailyHealthRecord[]) {
  download(`\uFEFF${recordsToCsv(records)}`, 'health-records.csv', 'text/csv;charset=utf-8');
}

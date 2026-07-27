import type { DailyHealthRecord } from '../models/health';
import { exportRecords } from './storage';

function download(content: string, fileName: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(records: DailyHealthRecord[]): void {
  download(
    exportRecords(records),
    `health-records-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json'
  );
}

export function recordsToCsv(records: DailyHealthRecord[]): string {
  const fields: (keyof DailyHealthRecord)[] = [
    'date',
    'steps',
    'activeCalories',
    'exerciseMinutes',
    'sleepHours',
    'weightKg',
    'bodyFatPercent',
    'waistCm',
    'strengthTraining',
    'lunchHighProtein',
    'dinnerHighProtein',
    'vegetablesCompleted',
    'noSugaryDrink',
    'noLateNightMeal',
    'notes'
  ];
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    fields.join(','),
    ...records.map((record) => fields.map((field) => escape(record[field])).join(','))
  ].join('\n');
}

export function downloadCsv(records: DailyHealthRecord[]): void {
  download(
    `\uFEFF${recordsToCsv(records)}`,
    `health-records-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8'
  );
}


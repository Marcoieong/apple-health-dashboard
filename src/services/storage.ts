import { createDemoRecords } from '../data/demoRecords';
import type {
  DailyHealthRecord,
  DataImportResult,
  HealthRecordInput
} from '../models/health';

export const schemaVersion = 1;
export const STORAGE_KEY = 'personal-health-dashboard:v1';

interface StorageEnvelope {
  schemaVersion: number;
  records: DailyHealthRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function migrate(envelope: StorageEnvelope): StorageEnvelope {
  // Placeholder for future schema versions. Migrations must remain deterministic.
  return envelope;
}

function validateImportedRecord(value: unknown, index: number): {
  record?: DailyHealthRecord;
  error?: string;
} {
  if (!isRecord(value) || !isValidDate(value.date)) {
    return { error: `第 ${index + 1} 筆：缺少有效日期。` };
  }
  const numericFields = [
    'steps',
    'activeCalories',
    'exerciseMinutes',
    'sleepHours',
    'weightKg',
    'bodyFatPercent',
    'waistCm'
  ];
  for (const field of numericFields) {
    const fieldValue = value[field];
    if (
      fieldValue !== undefined &&
      (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue) || fieldValue < 0)
    ) {
      return { error: `第 ${index + 1} 筆：${field} 必須是非負數字。` };
    }
  }
  const booleanFields = [
    'strengthTraining',
    'lunchHighProtein',
    'dinnerHighProtein',
    'vegetablesCompleted',
    'noSugaryDrink',
    'noLateNightMeal'
  ];
  for (const field of booleanFields) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') {
      return { error: `第 ${index + 1} 筆：${field} 必須是布林值。` };
    }
  }

  const now = new Date().toISOString();
  return {
    record: {
      ...(value as unknown as DailyHealthRecord),
      id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
      date: value.date,
      source: 'imported',
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
      updatedAt: now
    }
  };
}

export function loadRecords(seedDemo = true): DailyHealthRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const records = seedDemo ? createDemoRecords() : [];
      if (seedDemo) persist(records);
      return records;
    }
    const parsed = JSON.parse(raw) as StorageEnvelope;
    if (!isRecord(parsed) || !Array.isArray(parsed.records)) {
      throw new Error('儲存格式不正確');
    }
    return migrate(parsed).records;
  } catch {
    throw new Error('無法讀取本機健康資料。請先匯出備份，再清除損壞資料。');
  }
}

function persist(records: DailyHealthRecord[]): void {
  const envelope: StorageEnvelope = { schemaVersion, records };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function saveRecord(input: HealthRecordInput): DailyHealthRecord {
  const records = loadRecords(false);
  if (records.some((record) => record.date === input.date)) {
    throw new Error('此日期已有紀錄，請改為編輯原有紀錄。');
  }
  const now = new Date().toISOString();
  const record: DailyHealthRecord = {
    ...input,
    id: crypto.randomUUID(),
    source: 'manual',
    createdAt: now,
    updatedAt: now
  };
  persist([...records, record]);
  return record;
}

export function updateRecord(
  id: string,
  input: HealthRecordInput
): DailyHealthRecord {
  const records = loadRecords(false);
  const existing = records.find((record) => record.id === id);
  if (!existing) throw new Error('找不到要編輯的紀錄。');
  if (records.some((record) => record.id !== id && record.date === input.date)) {
    throw new Error('此日期已有另一筆紀錄。');
  }
  const updated: DailyHealthRecord = {
    ...existing,
    ...input,
    source: existing.source === 'demo' ? 'manual' : existing.source,
    updatedAt: new Date().toISOString()
  };
  persist(records.map((record) => (record.id === id ? updated : record)));
  return updated;
}

export function deleteRecord(id: string): void {
  persist(loadRecords(false).filter((record) => record.id !== id));
}

export function clearAllRecords(): void {
  persist([]);
}

export function exportRecords(records = loadRecords(false)): string {
  return JSON.stringify({ schemaVersion, exportedAt: new Date().toISOString(), records }, null, 2);
}

export function importRecords(json: string): DataImportResult {
  try {
    const parsed: unknown = JSON.parse(json);
    const items = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.records)
        ? parsed.records
        : null;
    if (!items) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['JSON 必須是紀錄陣列或包含 records 陣列。'],
        records: []
      };
    }
    const errors: string[] = [];
    const valid: DailyHealthRecord[] = [];
    items.forEach((item, index) => {
      const result = validateImportedRecord(item, index);
      if (result.record) valid.push(result.record);
      if (result.error) errors.push(result.error);
    });
    const deduplicated = new Map(valid.map((record) => [record.date, record]));
    const records = [...deduplicated.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (records.length) persist(records);
    return {
      success: records.length > 0 && errors.length === 0,
      imported: records.length,
      skipped: items.length - records.length,
      errors,
      records
    };
  } catch {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: ['無法解析 JSON。'],
      records: []
    };
  }
}

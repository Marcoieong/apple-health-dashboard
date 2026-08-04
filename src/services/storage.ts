import { createDemoRecords } from '../data/demoRecords';
import type {
  DailyHealthRecord,
  DataImportResult,
  HealthRecordInput,
} from '../models/health';

export const schemaVersion = 1;
export const STORAGE_KEY = 'personal-health-dashboard.records';

interface StorageEnvelope {
  schemaVersion: number;
  records: DailyHealthRecord[];
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `health-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isOptionalNumber(value: unknown) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isOptionalBoolean(value: unknown) {
  return value === undefined || typeof value === 'boolean';
}

function parseRecord(value: unknown, index: number): DailyHealthRecord {
  if (!value || typeof value !== 'object') {
    throw new Error(`第 ${index + 1} 筆紀錄不是有效物件。`);
  }

  const input = value as Partial<DailyHealthRecord>;
  if (!isDateKey(input.date)) {
    throw new Error(`第 ${index + 1} 筆紀錄的日期格式無效。`);
  }

  const numericFields = [
    'steps',
    'activeCalories',
    'exerciseMinutes',
    'sleepHours',
    'weightKg',
    'bodyFatPercent',
    'waistCm',
  ] as const;
  const booleanFields = [
    'strengthTraining',
    'lunchHighProtein',
    'dinnerHighProtein',
    'vegetablesCompleted',
    'noSugaryDrink',
    'noLateNightMeal',
  ] as const;

  if (numericFields.some((field) => !isOptionalNumber(input[field]))) {
    throw new Error(`第 ${index + 1} 筆紀錄含無效數字。`);
  }
  if (booleanFields.some((field) => !isOptionalBoolean(input[field]))) {
    throw new Error(`第 ${index + 1} 筆紀錄含無效選項。`);
  }
  if (input.notes !== undefined && typeof input.notes !== 'string') {
    throw new Error(`第 ${index + 1} 筆紀錄的備註格式無效。`);
  }

  const now = new Date().toISOString();
  return {
    ...input,
    id: typeof input.id === 'string' && input.id ? input.id : createId(),
    date: input.date,
    source: input.source === 'demo' || input.source === 'chatgpt' ? input.source : 'imported',
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
  };
}

function migrate(envelope: StorageEnvelope): StorageEnvelope {
  // Future schema migrations belong here.
  return envelope;
}

function persist(records: DailyHealthRecord[]) {
  const envelope: StorageEnvelope = { schemaVersion, records };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function loadRecords(seedDemo = true): DailyHealthRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const records = seedDemo ? createDemoRecords() : [];
    persist(records);
    return records;
  }

  let parsed: Partial<StorageEnvelope>;
  try {
    parsed = JSON.parse(raw) as Partial<StorageEnvelope>;
  } catch {
    throw new Error('無法讀取本機健康資料；儲存內容不是有效 JSON。');
  }
  if (!Array.isArray(parsed.records)) {
    throw new Error('本機資料格式損壞，請先匯出備份或清除資料。');
  }
  const envelope = migrate({
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0,
    records: parsed.records.map(parseRecord),
  });
  return [...envelope.records].sort((a, b) => b.date.localeCompare(a.date));
}

export function saveRecord(input: HealthRecordInput): DailyHealthRecord {
  const records = loadRecords(false);
  if (records.some((record) => record.date === input.date)) {
    throw new Error('該日期已有紀錄，請改用編輯。');
  }
  const now = new Date().toISOString();
  const record: DailyHealthRecord = {
    ...input,
    id: createId(),
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };
  persist([record, ...records]);
  return record;
}

export function updateRecord(id: string, input: HealthRecordInput): DailyHealthRecord {
  const records = loadRecords(false);
  const existing = records.find((record) => record.id === id);
  if (!existing) throw new Error('找不到要更新的紀錄。');
  if (records.some((record) => record.id !== id && record.date === input.date)) {
    throw new Error('該日期已有另一筆紀錄。');
  }
  const updated: DailyHealthRecord = {
    ...existing,
    ...input,
    source: existing.source === 'demo' ? 'manual' : existing.source,
    updatedAt: new Date().toISOString(),
  };
  persist(records.map((record) => (record.id === id ? updated : record)));
  return updated;
}

export function deleteRecord(id: string) {
  persist(loadRecords(false).filter((record) => record.id !== id));
}

export function clearAllRecords() {
  persist([]);
}

export function exportRecords(records = loadRecords(false)) {
  return JSON.stringify({ schemaVersion, exportedAt: new Date().toISOString(), records }, null, 2);
}

export function importRecords(json: string): DataImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { records: loadRecords(false), importedCount: 0, skippedCount: 0, errors: ['JSON 格式無效。'] };
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Partial<StorageEnvelope>).records)
      ? (parsed as Partial<StorageEnvelope>).records!
      : null;
  if (!candidates) {
    return { records: loadRecords(false), importedCount: 0, skippedCount: 0, errors: ['找不到 records 陣列。'] };
  }

  const existing = loadRecords(false);
  const existingDates = new Set(existing.map((record) => record.date));
  const errors: string[] = [];
  const byDate = new Map<string, DailyHealthRecord>();
  candidates.forEach((candidate, index) => {
    try {
      const record = parseRecord(candidate, index);
      if (existingDates.has(record.date) || byDate.has(record.date)) {
        errors.push(`第 ${index + 1} 筆日期重複，已略過。`);
      } else {
        byDate.set(record.date, record);
      }
    } catch (reason) {
      errors.push(reason instanceof Error ? reason.message : `第 ${index + 1} 筆無效。`);
    }
  });

  const imported = [...byDate.values()];
  const records = [...imported, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  if (imported.length > 0) persist(records);
  return {
    records,
    importedCount: imported.length,
    skippedCount: candidates.length - imported.length,
    errors,
  };
}

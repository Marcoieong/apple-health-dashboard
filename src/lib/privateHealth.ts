import type { DailyHealthRecord } from '../models/health';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface PrivateHealthDayResponse {
  local_date: string;
  timezone: string;
  source_updated_at: string;
  steps?: number;
  active_energy_kcal?: number;
  exercise_minutes?: number;
  sleep_hours?: number;
  weight_kg?: number;
  body_fat_percent?: number;
}

interface PrivateHealthDeviceResponse {
  deviceInstallationId: string;
  lastCollectedAt?: string;
  lastSyncAt?: string;
}

export interface PrivateHealthSyncStatus {
  deviceCount: number;
  latestCollectedAt?: string;
  latestSyncAt?: string;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isPrivateHealthDay(value: unknown): value is PrivateHealthDayResponse {
  if (!value || typeof value !== 'object') return false;
  const day = value as Record<string, unknown>;
  return (
    typeof day.local_date === 'string' &&
    LOCAL_DATE.test(day.local_date) &&
    typeof day.timezone === 'string' &&
    isIsoDateTime(day.source_updated_at) &&
    isOptionalFiniteNumber(day.steps) &&
    isOptionalFiniteNumber(day.active_energy_kcal) &&
    isOptionalFiniteNumber(day.exercise_minutes) &&
    isOptionalFiniteNumber(day.sleep_hours) &&
    isOptionalFiniteNumber(day.weight_kg) &&
    isOptionalFiniteNumber(day.body_fat_percent)
  );
}

function isPrivateHealthDevice(value: unknown): value is PrivateHealthDeviceResponse {
  if (!value || typeof value !== 'object') return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.deviceInstallationId === 'string' &&
    (device.lastCollectedAt === undefined || isIsoDateTime(device.lastCollectedAt)) &&
    (device.lastSyncAt === undefined || isIsoDateTime(device.lastSyncAt))
  );
}

function metric(value: number | undefined, key: keyof DailyHealthRecord) {
  return value === undefined ? {} : { [key]: value };
}

function toDailyHealthRecord(day: PrivateHealthDayResponse): DailyHealthRecord {
  return {
    id: `healthkit-${day.local_date}`,
    date: day.local_date,
    ...metric(day.steps, 'steps'),
    ...metric(day.active_energy_kcal, 'activeCalories'),
    ...metric(day.exercise_minutes, 'exerciseMinutes'),
    ...metric(day.sleep_hours, 'sleepHours'),
    ...metric(day.weight_kg, 'weightKg'),
    ...metric(day.body_fat_percent, 'bodyFatPercent'),
    source: 'healthkit',
    createdAt: day.source_updated_at,
    updatedAt: day.source_updated_at
  };
}

export function parsePrivateHealthResponse(value: unknown): DailyHealthRecord[] {
  const days =
    value && typeof value === 'object' && 'days' in value
      ? (value as { days?: unknown }).days
      : undefined;
  if (!Array.isArray(days) || !days.every(isPrivateHealthDay)) {
    throw new Error('私人健康資料格式不正確，已停止載入。');
  }
  return days.map(toDailyHealthRecord);
}

function latest(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => value !== undefined)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

export function parsePrivateHealthSyncStatus(value: unknown): PrivateHealthSyncStatus {
  const devices =
    value && typeof value === 'object' && 'devices' in value
      ? (value as { devices?: unknown }).devices
      : undefined;
  if (!Array.isArray(devices) || !devices.every(isPrivateHealthDevice)) {
    throw new Error('同步狀態格式不正確，已停止載入。');
  }
  return {
    deviceCount: devices.length,
    ...(latest(devices.map((device) => device.lastCollectedAt))
      ? { latestCollectedAt: latest(devices.map((device) => device.lastCollectedAt)) }
      : {}),
    ...(latest(devices.map((device) => device.lastSyncAt))
      ? { latestSyncAt: latest(devices.map((device) => device.lastSyncAt)) }
      : {})
  };
}

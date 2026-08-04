import { createHash } from 'node:crypto';
import { z } from 'zod';

export const HEALTH_SYNC_SCHEMA_VERSION = 1 as const;
export const HEALTH_METRIC_KEYS = [
  'steps',
  'active_energy_kcal',
  'exercise_minutes',
  'sleep_hours',
  'weight_kg',
  'body_fat_percent'
] as const;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE_INSTALLATION_ID = /^[A-Za-z0-9_-]{16,128}$/;

function isCalendarDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const healthMetricsSchema = z
  .object({
    steps: z.number().int().min(0).max(300_000).optional(),
    active_energy_kcal: z.number().finite().min(0).max(30_000).optional(),
    exercise_minutes: z.number().finite().min(0).max(1_440).optional(),
    sleep_hours: z.number().finite().min(0).max(24).optional(),
    weight_kg: z.number().finite().positive().max(1_000).optional(),
    body_fat_percent: z.number().finite().min(0).max(100).optional()
  })
  .strict()
  .refine(
    (metrics) => HEALTH_METRIC_KEYS.some((key) => metrics[key] !== undefined),
    { message: 'At least one aggregate health metric is required.' }
  );

export const healthSyncDaySchema = z
  .object({
    local_date: z.string().refine(isCalendarDate, 'Date must use YYYY-MM-DD.'),
    timezone: z.string().min(1).max(64).refine(isIanaTimezone, 'Timezone is invalid.'),
    source_updated_at: z.iso.datetime({ offset: true }),
    metrics: healthMetricsSchema
  })
  .strict();

export const healthSyncInputSchema = z
  .object({
    schema_version: z.literal(HEALTH_SYNC_SCHEMA_VERSION),
    sync_id: z.uuid(),
    device_installation_id: z.string().regex(DEVICE_INSTALLATION_ID),
    previous_cursor: z.string().min(1).max(256).optional(),
    collected_at: z.iso.datetime({ offset: true }),
    days: z.array(healthSyncDaySchema).min(1).max(31)
  })
  .strict()
  .superRefine((input, context) => {
    const seen = new Set<string>();
    input.days.forEach((day, index) => {
      if (seen.has(day.local_date)) {
        context.addIssue({
          code: 'custom',
          path: ['days', index, 'local_date'],
          message: 'Each local date may appear only once per sync.'
        });
      }
      seen.add(day.local_date);
    });
  });

export type HealthMetricsV1 = z.infer<typeof healthMetricsSchema>;
export type HealthSyncDayV1 = z.infer<typeof healthSyncDaySchema>;
export type HealthSyncInputV1 = z.infer<typeof healthSyncInputSchema>;

export interface HealthSyncResponseV1 {
  schema_version: typeof HEALTH_SYNC_SCHEMA_VERSION;
  sync_id: string;
  status: 'applied' | 'already_applied';
  accepted_days: number;
  changed_days: number;
  cursor: string;
  server_time: string;
}

export interface PrivateHealthDayV1 extends HealthMetricsV1 {
  local_date: string;
  timezone: string;
  source_updated_at: string;
}

export function parseHealthSyncInput(value: unknown): HealthSyncInputV1 {
  return healthSyncInputSchema.parse(value);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function digestHealthSyncInput(input: HealthSyncInputV1): string {
  return createHash('sha256').update(canonicalize(input)).digest('hex');
}

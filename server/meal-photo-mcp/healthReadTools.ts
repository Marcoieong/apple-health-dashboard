import { z } from 'zod';
import type { PrivateHealthDayV1 } from '../health-sync/contract.js';
import type { PrivateHealthSyncStatus } from '../health-sync/productionRepository.js';
import { HEALTH_READ_SCOPE } from './runtimeConfig.js';

const HEALTH_TIMEZONE = 'Asia/Macau';
const HEALTH_METRICS = [
  'steps',
  'active_energy_kcal',
  'exercise_minutes',
  'sleep_hours',
  'weight_kg',
  'body_fat_percent'
] as const;

type HealthMetric = (typeof HEALTH_METRICS)[number];

export interface HealthReadDependencies {
  listDays: (
    ownerId: string,
    from: string,
    to: string
  ) => Promise<PrivateHealthDayV1[]>;
  listSyncStatus: (ownerId: string) => Promise<PrivateHealthSyncStatus[]>;
  now?: () => Date;
}

export interface HealthSummary {
  period: {
    from: string;
    to: string;
    timezone: typeof HEALTH_TIMEZONE;
    requested_days: number;
  };
  days_with_data: number;
  daily: Array<
    Pick<PrivateHealthDayV1, 'local_date'> &
      Partial<Pick<PrivateHealthDayV1, HealthMetric>>
  >;
  averages: Partial<Record<HealthMetric, number>>;
  latest_measurements: {
    weight_kg?: number;
    body_fat_percent?: number;
  };
}

export interface HealthSyncSummary {
  connected_device_count: number;
  latest_sync_at?: string;
  latest_collected_at?: string;
  status: 'never_synced' | 'synced';
}

const healthDailyOutputSchema = z
  .object({
    local_date: z.string(),
    steps: z.number().optional(),
    active_energy_kcal: z.number().optional(),
    exercise_minutes: z.number().optional(),
    sleep_hours: z.number().optional(),
    weight_kg: z.number().optional(),
    body_fat_percent: z.number().optional()
  })
  .strict();

const healthMetricsOutputSchema = z
  .object({
    steps: z.number().optional(),
    active_energy_kcal: z.number().optional(),
    exercise_minutes: z.number().optional(),
    sleep_hours: z.number().optional(),
    weight_kg: z.number().optional(),
    body_fat_percent: z.number().optional()
  })
  .strict();

export const healthSummaryInputSchema = z
  .object({ days: z.number().int().min(1).max(31).default(7) })
  .strict();

export const healthSummaryOutputSchema = z
  .object({
    period: z
      .object({
        from: z.string(),
        to: z.string(),
        timezone: z.literal(HEALTH_TIMEZONE),
        requested_days: z.number().int().min(1).max(31)
      })
      .strict(),
    days_with_data: z.number().int().min(0).max(31),
    daily: z.array(healthDailyOutputSchema).max(31),
    averages: healthMetricsOutputSchema,
    latest_measurements: z
      .object({
        weight_kg: z.number().optional(),
        body_fat_percent: z.number().optional()
      })
      .strict()
  })
  .strict();

export const healthSyncStatusInputSchema = z.object({}).strict();

export const healthSyncStatusOutputSchema = z
  .object({
    connected_device_count: z.number().int().min(0),
    latest_sync_at: z.string().optional(),
    latest_collected_at: z.string().optional(),
    status: z.enum(['never_synced', 'synced'])
  })
  .strict();

const healthReadSecurityScheme = {
  type: 'oauth2',
  scopes: [HEALTH_READ_SCOPE]
} as const;

export const healthSummaryToolDescriptor = {
  name: 'get_health_summary',
  title: '讀取健康摘要',
  description:
    'Read 1–31 days of the signed-in member’s Apple Health aggregates for habit and trend summaries. Do not diagnose disease or claim that missing data is zero.',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  _meta: {
    securitySchemes: [healthReadSecurityScheme],
    'openai/toolInvocation/invoking': '正在讀取私人健康摘要…',
    'openai/toolInvocation/invoked': '已讀取私人健康摘要'
  }
} as const;

export const healthSyncStatusToolDescriptor = {
  name: 'get_health_sync_status',
  title: '查看健康同步狀態',
  description:
    'Read the signed-in member’s latest Apple Health sync timestamps. Device identifiers are never returned.',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  _meta: {
    securitySchemes: [healthReadSecurityScheme],
    'openai/toolInvocation/invoking': '正在檢查健康同步…',
    'openai/toolInvocation/invoked': '已檢查健康同步'
  }
} as const;

function macauDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HEALTH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function shiftCalendarDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function roundedAverage(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 100) / 100;
}

function withoutServerMetadata(day: PrivateHealthDayV1): HealthSummary['daily'][number] {
  return Object.fromEntries(
    [
      ['local_date', day.local_date],
      ...HEALTH_METRICS.map((metric) => [metric, day[metric]])
    ].filter((entry) => entry[1] !== undefined)
  ) as HealthSummary['daily'][number];
}

function latestMetric(
  days: PrivateHealthDayV1[],
  metric: 'weight_kg' | 'body_fat_percent'
): number | undefined {
  return [...days].reverse().find((day) => day[metric] !== undefined)?.[metric];
}

export async function getHealthSummary(
  ownerId: string,
  requestedDays: number,
  dependencies: HealthReadDependencies
): Promise<HealthSummary> {
  const to = macauDate((dependencies.now ?? (() => new Date()))());
  const from = shiftCalendarDate(to, -(requestedDays - 1));
  const days = await dependencies.listDays(ownerId, from, to);
  const orderedDays = [...days].sort((left, right) =>
    left.local_date.localeCompare(right.local_date)
  );

  const averages = Object.fromEntries(
    HEALTH_METRICS.flatMap((metric) => {
      const average = roundedAverage(
        orderedDays.flatMap((day) =>
          day[metric] === undefined ? [] : [day[metric]]
        )
      );
      return average === undefined ? [] : [[metric, average]];
    })
  ) as HealthSummary['averages'];

  const weight = latestMetric(orderedDays, 'weight_kg');
  const bodyFat = latestMetric(orderedDays, 'body_fat_percent');

  return {
    period: {
      from,
      to,
      timezone: HEALTH_TIMEZONE,
      requested_days: requestedDays
    },
    days_with_data: orderedDays.length,
    daily: orderedDays.map(withoutServerMetadata),
    averages,
    latest_measurements: {
      ...(weight === undefined ? {} : { weight_kg: weight }),
      ...(bodyFat === undefined ? {} : { body_fat_percent: bodyFat })
    }
  };
}

function latestIso(
  statuses: PrivateHealthSyncStatus[],
  key: 'lastSyncAt' | 'lastCollectedAt'
): string | undefined {
  return statuses
    .flatMap((status) => (status[key] ? [status[key]] : []))
    .sort()
    .at(-1);
}

export async function getHealthSyncSummary(
  ownerId: string,
  dependencies: HealthReadDependencies
): Promise<HealthSyncSummary> {
  const statuses = await dependencies.listSyncStatus(ownerId);
  const latestSyncAt = latestIso(statuses, 'lastSyncAt');
  const latestCollectedAt = latestIso(statuses, 'lastCollectedAt');
  return {
    connected_device_count: statuses.length,
    ...(latestSyncAt ? { latest_sync_at: latestSyncAt } : {}),
    ...(latestCollectedAt ? { latest_collected_at: latestCollectedAt } : {}),
    status: latestSyncAt ? 'synced' : 'never_synced'
  };
}

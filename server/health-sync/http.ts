import type { VercelRequest } from '@vercel/node';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

export function extractHealthSyncBearerToken(
  authorization: string | string[] | undefined
): string | undefined {
  const value = singleValue(authorization)?.trim();
  const match = value?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

export function assertJsonRequest(request: VercelRequest): void {
  const contentType = singleValue(request.headers['content-type']) ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('invalid_content_type');
  }
}

export interface HealthDateRange {
  from: string;
  to: string;
}

export function parseHealthDateRange(
  query: VercelRequest['query'],
  now: Date = new Date()
): HealthDateRange {
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFromDate = new Date(`${defaultTo}T00:00:00.000Z`);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const from = singleValue(query.from) ?? defaultFromDate.toISOString().slice(0, 10);
  const to = singleValue(query.to) ?? defaultTo;

  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    throw new Error('invalid_date_range');
  }
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  const inclusiveDays = Math.floor((toTime - fromTime) / 86_400_000) + 1;
  if (inclusiveDays < 1 || inclusiveDays > 366) {
    throw new Error('invalid_date_range');
  }
  return { from, to };
}

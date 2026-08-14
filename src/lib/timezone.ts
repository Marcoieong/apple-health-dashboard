export const DEFAULT_TIME_ZONE = 'Asia/Macau';

export function resolveTimeZone(
  value: string | undefined,
  fallback = DEFAULT_TIME_ZONE
): string {
  if (!value) return fallback;

  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return value;
  } catch {
    return fallback;
  }
}

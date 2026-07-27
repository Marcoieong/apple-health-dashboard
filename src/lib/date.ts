export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function formatDateZh(dateKey: string, includeYear = true): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat('zh-Hant-MO', {
    ...(includeYear ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date);
}

export function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}


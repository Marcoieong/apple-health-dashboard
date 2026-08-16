import type { PrivateHealthDayV1 } from '../health-sync/contract.js';
import { scopesVisibleTo } from './access.js';
import type { SharingScope } from './contract.js';

type MetricStatus = 'met' | 'close' | 'attention' | 'unavailable';

interface FamilyBoardMetric {
  status: MetricStatus;
  progressPercent: number | null;
  label: string;
}

interface FamilyBoardMember {
  memberId: string;
  displayName: string;
  avatarLabel?: string;
  isCurrentUser: boolean;
  asOfDate: string;
  score: number | null;
  rating: string | null;
  weeklyDirection: 'up' | 'down' | 'flat' | 'unknown';
  metrics: {
    steps: FamilyBoardMetric;
    exercise: FamilyBoardMetric;
    sleep: FamilyBoardMetric;
  };
  advice: string;
  sharedScopes: SharingScope[];
}

interface FamilyBoardResponse {
  schemaVersion: 1;
  household: { id: string; name: string };
  generatedAt: string;
  refreshAfterSeconds: number;
  members: FamilyBoardMember[];
}

const allUnavailable = {
  steps: { status: 'unavailable', progressPercent: null, label: '未分享活動狀態' },
  exercise: { status: 'unavailable', progressPercent: null, label: '未分享運動狀態' },
  sleep: { status: 'unavailable', progressPercent: null, label: '未分享睡眠狀態' }
} as const;

function dateInMacau(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Macau', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function metric(
  value: number | undefined,
  minimum: number,
  preferred: number,
  labels: [string, string, string]
) {
  if (value === undefined) return { status: 'unavailable' as const, progressPercent: null, label: '未有資料' };
  const progressPercent = Math.min(200, Math.round((value / preferred) * 100));
  if (value >= preferred) return { status: 'met' as const, progressPercent, label: labels[0] };
  if (value >= minimum) return { status: 'close' as const, progressPercent, label: labels[1] };
  return { status: 'attention' as const, progressPercent, label: labels[2] };
}

function trend(days: PrivateHealthDayV1[]): FamilyBoardMember['weeklyDirection'] {
  if (days.length < 8) return 'unknown';
  const score = (day: PrivateHealthDayV1) =>
    (day.steps ?? 0) / 10_000 + (day.exercise_minutes ?? 0) / 45 + (day.sleep_hours ?? 0) / 8;
  const recent = days.slice(-7).reduce((sum, day) => sum + score(day), 0) / 7;
  const previousDays = days.slice(-14, -7);
  if (!previousDays.length) return 'unknown';
  const previous = previousDays.reduce((sum, day) => sum + score(day), 0) / previousDays.length;
  if (previous === 0) return recent > 0 ? 'up' : 'flat';
  const change = (recent - previous) / previous;
  return change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'flat';
}

function adviceFor(day: PrivateHealthDayV1 | undefined): string {
  if (!day) return '尚未有可用資料，請先在自己的 iPhone 同步 Apple Health。';
  if ((day.sleep_hours ?? 0) < 7) return '今晚優先安排充足睡眠，毋須以大量運動作補償。';
  if ((day.steps ?? 0) < 9_000) return '可在飯後安排一段輕鬆步行，逐步接近日常活動目標。';
  if ((day.exercise_minutes ?? 0) < 30) return '可安排低至中強度活動，按當日狀態量力而為。';
  return '主要活動指標已達標，今晚以補水、恢復和規律作息為主。';
}

export function buildFamilyBoardMember(input: {
  ownerId: string;
  memberId: string;
  displayName: string;
  isCurrentUser: boolean;
  viewerOwnerId: string;
  grants: Parameters<typeof scopesVisibleTo>[2];
  days: PrivateHealthDayV1[];
}): FamilyBoardMember | undefined {
  const scopes = scopesVisibleTo(input.ownerId, input.viewerOwnerId, input.grants);
  if (!scopes.length) return undefined;
  const latest = input.days.at(-1);
  const has = (scope: SharingScope) => scopes.includes(scope);
  const activityShared = has('activity_status');

  return {
    memberId: input.memberId,
    displayName: input.displayName,
    avatarLabel: input.displayName.slice(0, 1),
    isCurrentUser: input.isCurrentUser,
    asOfDate: latest?.local_date ?? dateInMacau(),
    score: null,
    rating: null,
    weeklyDirection: has('weekly_direction') ? trend(input.days) : 'unknown',
    metrics: {
      steps: activityShared
        ? metric(latest?.steps, 9_000, 10_000, ['已達步數目標', '接近日常步數目標', '活動量仍有空間'])
        : allUnavailable.steps,
      exercise: activityShared
        ? metric(latest?.exercise_minutes, 30, 45, ['已達運動目標', '已達最低運動量', '運動時間仍有空間'])
        : allUnavailable.exercise,
      sleep: has('sleep_status')
        ? metric(latest?.sleep_hours, 6.5, 7, ['已達睡眠目標', '接近睡眠目標', '睡眠時間需留意'])
        : allUnavailable.sleep
    },
    advice: has('advice') ? adviceFor(latest) : '未分享今日建議。',
    sharedScopes: scopes
  };
}

export function boardDateRange(today = dateInMacau()) {
  return { from: shiftDate(today, -13), to: today };
}

export function makeFamilyBoardResponse(input: {
  household: { id: string; name: string };
  members: FamilyBoardMember[];
}): FamilyBoardResponse {
  return {
    schemaVersion: 1,
    household: input.household,
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: 300,
    members: input.members
  };
}

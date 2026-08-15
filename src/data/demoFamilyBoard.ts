import type { FamilyBoardResponse } from '../contracts/familyBoard';
import { todayKey } from '../lib/date';

const sharedScopes = [
  'score',
  'activity_status',
  'sleep_status',
  'weekly_direction',
  'advice'
] as const;

export function createDemoFamilyBoard(): FamilyBoardResponse {
  const date = todayKey();

  return {
    schemaVersion: 1,
    household: { id: 'demo-household', name: '示範家庭' },
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: 300,
    members: [
      {
        memberId: 'demo-a', displayName: '示範成員 A', avatarLabel: 'A',
        isCurrentUser: true, asOfDate: date, score: 86, rating: 'Very Good',
        weeklyDirection: 'up', sharedScopes: [...sharedScopes],
        metrics: {
          steps: { status: 'met', progressPercent: 108, label: '步數已達標' },
          exercise: { status: 'close', progressPercent: 83, label: '尚差 5 分鐘' },
          sleep: { status: 'met', progressPercent: 100, label: '睡眠達標' }
        },
        advice: '晚飯後輕鬆步行 10 分鐘，完成今天的活動目標。'
      },
      {
        memberId: 'demo-b', displayName: '示範成員 B', avatarLabel: 'B',
        isCurrentUser: false, asOfDate: date, score: 74, rating: 'Good',
        weeklyDirection: 'flat', sharedScopes: [...sharedScopes],
        metrics: {
          steps: { status: 'close', progressPercent: 78, label: '活動量接近目標' },
          exercise: { status: 'attention', progressPercent: 50, label: '運動時間較少' },
          sleep: { status: 'met', progressPercent: 100, label: '睡眠達標' }
        },
        advice: '今天先完成 15 分鐘低至中強度活動，不需要追趕高強度運動。'
      },
      {
        memberId: 'demo-c', displayName: '示範成員 C', avatarLabel: 'C',
        isCurrentUser: false, asOfDate: date, score: null, rating: null,
        weeklyDirection: 'unknown', sharedScopes: [...sharedScopes],
        metrics: {
          steps: { status: 'unavailable', progressPercent: null, label: '今天尚未同步' },
          exercise: { status: 'unavailable', progressPercent: null, label: '等待資料' },
          sleep: { status: 'unavailable', progressPercent: null, label: '等待資料' }
        },
        advice: '等待本人的裝置完成同步；家庭看板不會代為估算。'
      }
    ]
  };
}

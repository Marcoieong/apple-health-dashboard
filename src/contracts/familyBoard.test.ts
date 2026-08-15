import { describe, expect, it } from 'vitest';
import { createDemoFamilyBoard } from '../data/demoFamilyBoard';
import { parseFamilyBoardResponse } from './familyBoard';

describe('家庭看板資料合約', () => {
  it('接受清楚標示的示範家庭摘要', () => {
    const result = parseFamilyBoardResponse(createDemoFamilyBoard());

    expect(result.schemaVersion).toBe(1);
    expect(result.members).toHaveLength(3);
    expect(result.members[0].sharedScopes).toContain('activity_status');
  });

  it.each([
    ['登入電郵', { email: 'private@example.com' }],
    ['體重', { weightKg: 92.4 }],
    ['飲食備註', { notes: '私人內容' }]
  ])('拒絕在成員摘要混入%s', (_label, privateField) => {
    const value = createDemoFamilyBoard();
    value.members[0] = { ...value.members[0], ...privateField };

    expect(() => parseFamilyBoardResponse(value)).toThrow();
  });

  it('拒絕過密的客廳自動更新頻率', () => {
    const value = createDemoFamilyBoard();
    value.refreshAfterSeconds = 30;

    expect(() => parseFamilyBoardResponse(value)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { parseHouseholdSnapshot } from './household';

const validSnapshot = {
  household: {
    id: '1f1dcbbf-03ea-42a4-a916-2667052ea55d',
    name: 'Marco 家庭',
    role: 'owner'
  },
  members: [{
    memberId: '43386bd0-c91d-47c4-98a8-38da646a86f5',
    displayName: 'Marco',
    role: 'owner',
    sharedByMe: ['activity_status'],
    isCurrentUser: true
  }],
  invitations: []
};

describe('household contract', () => {
  it('accepts the privacy-limited management snapshot', () => {
    expect(parseHouseholdSnapshot(validSnapshot).household.name).toBe('Marco 家庭');
  });

  it('rejects unexpected health data in the household response', () => {
    expect(() => parseHouseholdSnapshot({
      ...validSnapshot,
      members: [{ ...validSnapshot.members[0], weightKg: 98 }]
    })).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { canViewSubject, scopesVisibleTo, type SharingGrant } from './access.js';

describe('family sharing boundary', () => {
  const grants: SharingGrant[] = [
    { subjectOwnerId: 'bob', viewerOwnerId: 'alice', scope: 'activity_status' },
    { subjectOwnerId: 'bob', viewerOwnerId: 'alice', scope: 'advice' }
  ];

  it('only exposes explicitly granted scopes to the selected account', () => {
    expect(scopesVisibleTo('bob', 'alice', grants)).toEqual([
      'activity_status',
      'advice'
    ]);
    expect(scopesVisibleTo('bob', 'carol', grants)).toEqual([]);
    expect(canViewSubject('bob', 'carol', grants)).toBe(false);
  });

  it('keeps the member own summary visible without granting another account', () => {
    expect(canViewSubject('bob', 'bob', [])).toBe(true);
    expect(scopesVisibleTo('bob', 'bob', [])).toHaveLength(5);
  });

  it('stops access immediately when grants are revoked', () => {
    expect(canViewSubject('bob', 'alice', grants)).toBe(true);
    expect(canViewSubject('bob', 'alice', [])).toBe(false);
  });
});

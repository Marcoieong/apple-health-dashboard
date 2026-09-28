import type { SharingScope } from './contract.js';

export interface SharingGrant {
  subjectOwnerId: string;
  viewerOwnerId: string;
  scope: SharingScope;
}

export function scopesVisibleTo(
  subjectOwnerId: string,
  viewerOwnerId: string,
  grants: SharingGrant[]
): SharingScope[] {
  if (subjectOwnerId === viewerOwnerId) {
    return ['score', 'activity_status', 'sleep_status', 'weekly_direction', 'advice'];
  }
  return [...new Set(
    grants
      .filter(
        (grant) =>
          grant.subjectOwnerId === subjectOwnerId &&
          grant.viewerOwnerId === viewerOwnerId
      )
      .map((grant) => grant.scope)
  )];
}

export function canViewSubject(
  subjectOwnerId: string,
  viewerOwnerId: string,
  grants: SharingGrant[]
): boolean {
  return scopesVisibleTo(subjectOwnerId, viewerOwnerId, grants).length > 0;
}

import { z } from 'zod';

export const sharingScopeSchema = z.enum([
  'score',
  'activity_status',
  'sleep_status',
  'weekly_direction',
  'advice'
]);

export const createHouseholdInputSchema = z
  .object({ name: z.string().trim().min(1).max(80) })
  .strict();

export const createInvitationInputSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();

export const acceptInvitationInputSchema = z
  .object({ token: z.string().trim().min(32).max(256) })
  .strict();

export const updateSharingInputSchema = z
  .object({
    viewerMemberId: z.string().uuid(),
    scopes: z.array(sharingScopeSchema).max(5)
  })
  .strict();

export const revokeInvitationInputSchema = z
  .object({ invitationId: z.string().uuid() })
  .strict();

export type SharingScope = z.infer<typeof sharingScopeSchema>;

export interface HouseholdMemberRecord {
  memberId: string;
  displayName: string;
  role: 'owner' | 'member';
  sharedByMe: SharingScope[];
  isCurrentUser: boolean;
}

export interface HouseholdSnapshot {
  household: { id: string; name: string; role: 'owner' | 'member' };
  members: HouseholdMemberRecord[];
  invitations: Array<{
    id: string;
    email: string;
    expiresAt: string;
  }>;
}

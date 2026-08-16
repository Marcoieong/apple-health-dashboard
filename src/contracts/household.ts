import { z } from 'zod';

export const householdSharingScopeSchema = z.enum([
  'score',
  'activity_status',
  'sleep_status',
  'weekly_direction',
  'advice'
]);

const householdMemberSchema = z
  .object({
    memberId: z.string().uuid(),
    displayName: z.string().min(1).max(60),
    role: z.enum(['owner', 'member']),
    sharedByMe: z.array(householdSharingScopeSchema).max(5),
    isCurrentUser: z.boolean()
  })
  .strict();

export const householdSnapshotSchema = z
  .object({
    household: z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        role: z.enum(['owner', 'member'])
      })
      .strict(),
    members: z.array(householdMemberSchema).max(12),
    invitations: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            email: z.string().email(),
            expiresAt: z.string().datetime()
          })
          .strict()
      )
      .max(24)
  })
  .strict();

export type HouseholdSharingScope = z.infer<typeof householdSharingScopeSchema>;
export type HouseholdSnapshot = z.infer<typeof householdSnapshotSchema>;

export function parseHouseholdSnapshot(value: unknown): HouseholdSnapshot {
  return householdSnapshotSchema.parse(value);
}

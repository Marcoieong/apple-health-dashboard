import { z } from 'zod';

export const FAMILY_BOARD_SCHEMA_VERSION = 1 as const;

export const familyBoardScopeSchema = z.enum([
  'score',
  'activity_status',
  'sleep_status',
  'weekly_direction',
  'advice'
]);

const metricSchema = z
  .object({
    status: z.enum(['met', 'close', 'attention', 'unavailable']),
    progressPercent: z.number().min(0).max(200).nullable(),
    label: z.string().min(1).max(80)
  })
  .strict();

export const familyBoardMemberSchema = z
  .object({
    memberId: z.string().min(1).max(160),
    displayName: z.string().min(1).max(60),
    avatarLabel: z.string().min(1).max(4).optional(),
    isCurrentUser: z.boolean(),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    score: z.number().int().min(0).max(100).nullable(),
    rating: z.string().min(1).max(40).nullable(),
    weeklyDirection: z.enum(['up', 'down', 'flat', 'unknown']),
    metrics: z
      .object({
        steps: metricSchema,
        exercise: metricSchema,
        sleep: metricSchema
      })
      .strict(),
    advice: z.string().min(1).max(240),
    sharedScopes: z.array(familyBoardScopeSchema).max(5)
  })
  .strict();

export const familyBoardResponseSchema = z
  .object({
    schemaVersion: z.literal(FAMILY_BOARD_SCHEMA_VERSION),
    household: z
      .object({
        id: z.string().min(1).max(160),
        name: z.string().min(1).max(80)
      })
      .strict(),
    generatedAt: z.string().datetime(),
    refreshAfterSeconds: z.number().int().min(60).max(900),
    members: z.array(familyBoardMemberSchema).max(12)
  })
  .strict();

export type FamilyBoardScope = z.infer<typeof familyBoardScopeSchema>;
export type FamilyBoardMember = z.infer<typeof familyBoardMemberSchema>;
export type FamilyBoardResponse = z.infer<typeof familyBoardResponseSchema>;

export function parseFamilyBoardResponse(value: unknown): FamilyBoardResponse {
  return familyBoardResponseSchema.parse(value);
}

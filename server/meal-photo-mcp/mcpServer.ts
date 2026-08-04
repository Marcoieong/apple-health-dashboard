import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  AuthContext,
  RecordMealInput,
  RecordMealResult
} from './contracts.js';
import { recordMealToolDescriptor } from './toolDescriptor.js';

const fileParamSchema = z
  .object({
    download_url: z.url(),
    file_id: z.string().min(1),
    mime_type: z.string().optional(),
    file_name: z.string().optional()
  })
  .strict();

export const recordMealInputSchema = z
  .object({
    photos: z.array(fileParamSchema).min(1).max(4),
    client_request_id: z.string().min(8).max(128),
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().min(1).max(64),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    food_labels: z.array(z.string().min(1).max(80)).max(30).optional(),
    preparation_methods: z.array(z.string().min(1).max(60)).max(12).optional(),
    notes: z.string().max(500).optional()
  })
  .strict();

const recordMealOutputSchema = z
  .object({
    local_date: z.string(),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    photo_count: z.number().int().min(1).max(4),
    reused_photo_count: z.number().int().min(0).max(4),
    status: z.enum(['recorded', 'already_recorded'])
  })
  .strict();

export type ExecuteRecordMeal = (
  input: RecordMealInput,
  auth: AuthContext
) => Promise<RecordMealResult>;

export function createMealMcpServer(
  executeRecordMeal?: ExecuteRecordMeal
): McpServer {
  const server = new McpServer({
    name: 'personal-health-dashboard',
    version: '0.1.0'
  });

  server.registerTool(
    recordMealToolDescriptor.name,
    {
      title: recordMealToolDescriptor.title,
      description: recordMealToolDescriptor.description,
      inputSchema: recordMealInputSchema,
      outputSchema: recordMealOutputSchema,
      annotations: recordMealToolDescriptor.annotations,
      _meta: recordMealToolDescriptor._meta
    },
    async (input, extra) => {
      const ownerId = extra.authInfo?.extra?.ownerId;
      if (
        typeof ownerId !== 'string' ||
        !extra.authInfo?.scopes.includes('meal.write')
      ) {
        return {
          isError: true,
          content: [{ type: 'text', text: '需要 meal.write 授權。' }]
        };
      }

      if (!executeRecordMeal) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: '私人儲存尚未啟用；本次沒有寫入或保留任何照片。'
            }
          ]
        };
      }

      const result = await executeRecordMeal(input as RecordMealInput, {
        subject: ownerId,
        scopes: extra.authInfo.scopes
      });
      return {
        content: [
          {
            type: 'text',
            text:
              result.status === 'recorded'
                ? '餐食已安全記錄。'
                : '這餐已記錄，沒有重複新增。'
          }
        ],
        structuredContent: { ...result }
      };
    }
  );

  return server;
}

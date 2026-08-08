import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type {
  AuthContext,
  RecordMealInput,
  RecordMealResult
} from './contracts.js';
import {
  getHealthSummary,
  getHealthSyncSummary,
  healthSummaryInputSchema,
  healthSummaryOutputSchema,
  healthSummaryToolDescriptor,
  healthSyncStatusInputSchema,
  healthSyncStatusOutputSchema,
  healthSyncStatusToolDescriptor,
  type HealthReadDependencies
} from './healthReadTools.js';
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

function installOpenAiToolCatalogue(
  server: McpServer,
  includeMealWrite: boolean
): void {
  const readTools = [
    {
      ...healthSummaryToolDescriptor,
      inputSchema: z.toJSONSchema(healthSummaryInputSchema),
      outputSchema: z.toJSONSchema(healthSummaryOutputSchema)
    },
    {
      ...healthSyncStatusToolDescriptor,
      inputSchema: z.toJSONSchema(healthSyncStatusInputSchema),
      outputSchema: z.toJSONSchema(healthSyncStatusOutputSchema)
    }
  ];
  const tools = includeMealWrite
    ? [
        {
          ...recordMealToolDescriptor,
          inputSchema: z.toJSONSchema(recordMealInputSchema),
          outputSchema: z.toJSONSchema(recordMealOutputSchema)
        },
        ...readTools
      ]
    : readTools;

  // The MCP SDK currently serializes `_meta.securitySchemes` but omits the
  // top-level OpenAI Apps SDK extension. Replace only tools/list so ChatGPT
  // receives both copies; tools/call remains managed and validated by MCP.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools
  }));
}

export function createMealMcpServer(
  executeRecordMeal?: ExecuteRecordMeal,
  healthReadDependencies?: HealthReadDependencies
): McpServer {
  const server = new McpServer({
    name: 'personal-health-dashboard',
    version: '0.1.0'
  });

  if (executeRecordMeal) {
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
  }

  server.registerTool(
    healthSummaryToolDescriptor.name,
    {
      title: healthSummaryToolDescriptor.title,
      description: healthSummaryToolDescriptor.description,
      inputSchema: healthSummaryInputSchema,
      outputSchema: healthSummaryOutputSchema,
      annotations: healthSummaryToolDescriptor.annotations,
      _meta: healthSummaryToolDescriptor._meta
    },
    async ({ days }, extra) => {
      const ownerId = extra.authInfo?.extra?.ownerId;
      if (
        typeof ownerId !== 'string' ||
        !extra.authInfo?.scopes.includes('health.read')
      ) {
        return {
          isError: true,
          content: [{ type: 'text', text: '需要 health.read 授權。' }]
        };
      }
      if (!healthReadDependencies) {
        return {
          isError: true,
          content: [{ type: 'text', text: '私人健康資料讀取尚未啟用。' }]
        };
      }
      const result = await getHealthSummary(
        ownerId,
        days,
        healthReadDependencies
      );
      return {
        content: [
          {
            type: 'text',
            text:
              result.days_with_data === 0
                ? '所選期間尚沒有 Apple Health 同步資料。'
                : `已讀取 ${result.days_with_data} 日私人健康資料。`
          }
        ],
        structuredContent: { ...result }
      };
    }
  );

  server.registerTool(
    healthSyncStatusToolDescriptor.name,
    {
      title: healthSyncStatusToolDescriptor.title,
      description: healthSyncStatusToolDescriptor.description,
      inputSchema: healthSyncStatusInputSchema,
      outputSchema: healthSyncStatusOutputSchema,
      annotations: healthSyncStatusToolDescriptor.annotations,
      _meta: healthSyncStatusToolDescriptor._meta
    },
    async (_input, extra) => {
      const ownerId = extra.authInfo?.extra?.ownerId;
      if (
        typeof ownerId !== 'string' ||
        !extra.authInfo?.scopes.includes('health.read')
      ) {
        return {
          isError: true,
          content: [{ type: 'text', text: '需要 health.read 授權。' }]
        };
      }
      if (!healthReadDependencies) {
        return {
          isError: true,
          content: [{ type: 'text', text: '私人健康資料讀取尚未啟用。' }]
        };
      }
      const result = await getHealthSyncSummary(
        ownerId,
        healthReadDependencies
      );
      return {
        content: [
          {
            type: 'text',
            text:
              result.status === 'synced'
                ? 'Apple Health 最近同步狀態已讀取。'
                : '尚未收到 Apple Health 同步。'
          }
        ],
        structuredContent: { ...result }
      };
    }
  );

  installOpenAiToolCatalogue(server, Boolean(executeRecordMeal));

  return server;
}

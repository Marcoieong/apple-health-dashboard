import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  listPrivateHealthDays,
  listPrivateHealthSyncStatus,
  loadHealthReadConfig
} from '../server/health-sync/index.js';
import {
  buildWwwAuthenticate,
  createProductionRecordMealDependencies,
  createMealMcpServer,
  extractBearerToken,
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig,
  loadChatGptMcpStorageConfig,
  recordMeal,
  verifyMcpAccessToken
} from '../server/meal-photo-mcp/index.js';

type AuthenticatedVercelRequest = VercelRequest & { auth?: AuthInfo };
let dependencies:
  | ReturnType<typeof createProductionRecordMealDependencies>
  | undefined;

function getDependencies() {
  dependencies ??= createProductionRecordMealDependencies(
    loadChatGptMcpStorageConfig()
  );
  return dependencies;
}

function sendJson(
  response: VercelResponse,
  status: number,
  body: Record<string, unknown>
): void {
  response
    .status(status)
    .setHeader('Cache-Control', 'private, no-store')
    .json(body);
}

export default async function handler(
  request: AuthenticatedVercelRequest,
  response: VercelResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'private, no-store');

  if (!['GET', 'POST', 'DELETE'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, POST, DELETE');
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  const readiness = getChatGptMcpReadiness(process.env, true);
  if (!readiness.authConfigured) {
    sendJson(response, 503, {
      error: 'service_locked',
      message: 'ChatGPT MCP OAuth is not configured.'
    });
    return;
  }

  const config = loadChatGptMcpRuntimeConfig();
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    response.setHeader('WWW-Authenticate', buildWwwAuthenticate(config));
    sendJson(response, 401, { error: 'unauthorized' });
    return;
  }

  try {
    request.auth = await verifyMcpAccessToken(token, config);
  } catch {
    response.setHeader('WWW-Authenticate', buildWwwAuthenticate(config));
    sendJson(response, 401, { error: 'invalid_token' });
    return;
  }

  const healthReadConfig = readiness.healthReadConfigured
    ? loadHealthReadConfig()
    : undefined;
  const server = createMealMcpServer(
    readiness.mealWriteConfigured
      ? (input, auth) => recordMeal(input, auth, getDependencies())
      : undefined,
    healthReadConfig
      ? {
          listDays: (ownerId, from, to) =>
            listPrivateHealthDays(ownerId, from, to, healthReadConfig),
          listSyncStatus: (ownerId) =>
            listPrivateHealthSyncStatus(ownerId, healthReadConfig)
        }
      : undefined
  );
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } finally {
    await transport.close();
    await server.close();
  }
}

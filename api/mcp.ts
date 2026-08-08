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
  createMealMcpServer,
  extractBearerToken,
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig,
  normalizeMcpPostAcceptHeader,
  normalizeMcpPostRawHeaders,
  verifyMcpAccessToken
} from '../server/meal-photo-mcp/index.js';

type AuthenticatedVercelRequest = VercelRequest & { auth?: AuthInfo };

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
  // ChatGPT scans the MCP tool catalogue before completing OAuth. Keep
  // discovery public, while every private health tool still enforces the
  // verified `health.read` scope inside its handler.
  if (token) {
    try {
      request.auth = await verifyMcpAccessToken(token, config);
    } catch {
      response.setHeader('WWW-Authenticate', buildWwwAuthenticate(config));
      sendJson(response, 401, { error: 'invalid_token' });
      return;
    }
  }

  const healthReadConfig = readiness.healthReadConfigured
    ? loadHealthReadConfig()
    : undefined;
  const server = createMealMcpServer(
    undefined,
    healthReadConfig
      ? {
          listDays: (ownerId, from, to) =>
            listPrivateHealthDays(ownerId, from, to, healthReadConfig),
          listSyncStatus: (ownerId) =>
            listPrivateHealthSyncStatus(ownerId, healthReadConfig)
        }
      : undefined,
    buildWwwAuthenticate(config, {
      error: 'insufficient_scope',
      errorDescription: 'health.read scope is required'
    })
  );
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    request.headers.accept = normalizeMcpPostAcceptHeader(
      request.method,
      request.headers.accept
    );
    const normalizedRawHeaders = normalizeMcpPostRawHeaders(
      request.method,
      request.rawHeaders
    );
    request.rawHeaders.splice(
      0,
      request.rawHeaders.length,
      ...normalizedRawHeaders
    );
    await transport.handleRequest(request, response, request.body);
  } finally {
    await transport.close();
    await server.close();
  }
}

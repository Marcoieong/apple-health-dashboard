import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  buildWwwAuthenticate,
  createMealMcpServer,
  extractBearerToken,
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig,
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

  const readiness = getChatGptMcpReadiness();
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

  const server = createMealMcpServer();
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

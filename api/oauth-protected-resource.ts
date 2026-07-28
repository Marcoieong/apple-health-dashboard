import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig,
  MEAL_WRITE_SCOPE
} from '../server/meal-photo-mcp/index.js';

export default function handler(
  request: VercelRequest,
  response: VercelResponse
): void {
  if (request.method !== 'GET') {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!getChatGptMcpReadiness().authConfigured) {
    response.setHeader('Cache-Control', 'private, no-store');
    response.status(503).json({
      error: 'service_locked',
      message: 'ChatGPT MCP OAuth is not configured.'
    });
    return;
  }

  const config = loadChatGptMcpRuntimeConfig();
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.status(200).json({
    resource: config.resourceUrl.href,
    authorization_servers: [config.authorizationServer.href],
    scopes_supported: [MEAL_WRITE_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: '個人健康 Dashboard ChatGPT 導入'
  });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getChatGptMcpReadiness } from '../server/meal-photo-mcp/index.js';

export default function handler(
  request: VercelRequest,
  response: VercelResponse
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  response.status(200).json({
    service: 'personal-health-dashboard-chatgpt-mcp',
    ...getChatGptMcpReadiness()
  });
}

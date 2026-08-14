import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePrivateApi } from '../../../server/private-api/router.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  request.query = {
    ...request.query,
    path: ['health', 'sync-status']
  };
  await handlePrivateApi(request, response);
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listPrivateHealthSyncStatus,
  loadHealthSyncConfig
} from '../../../server/health-sync/index.js';
import { requireFamilySession } from '../../../server/family-auth/index.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const { session } = await requireFamilySession(request);
    response.status(200).json({
      devices: await listPrivateHealthSyncStatus(
        session.ownerId,
        loadHealthSyncConfig()
      )
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

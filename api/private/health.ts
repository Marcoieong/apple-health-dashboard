import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listPrivateHealthDays,
  loadHealthSyncConfig,
  parseHealthDateRange
} from '../../server/health-sync/index.js';
import { requireFamilySession } from '../../server/family-auth/index.js';

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
    const range = parseHealthDateRange(request.query);
    response.status(200).json({
      range,
      days: await listPrivateHealthDays(
        session.ownerId,
        range.from,
        range.to,
        loadHealthSyncConfig()
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'unauthorized') {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (message === 'invalid_date_range') {
      response.status(400).json({ error: 'invalid_date_range' });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

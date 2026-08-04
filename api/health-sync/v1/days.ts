import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import {
  applyHealthSync,
  assertJsonRequest,
  authenticateHealthSyncToken,
  createProductionHealthSyncRepository,
  extractHealthSyncBearerToken,
  HealthSyncConflictError,
  loadHealthSyncConfig,
  parseHealthSyncInput
} from '../../../server/health-sync/index.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    assertJsonRequest(request);
    const config = loadHealthSyncConfig();
    const token = extractHealthSyncBearerToken(request.headers.authorization);
    const claims = token
      ? await authenticateHealthSyncToken(token, config)
      : undefined;
    if (!claims) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }

    const input = parseHealthSyncInput(request.body);
    if (input.device_installation_id !== claims.deviceInstallationId) {
      response.status(403).json({ error: 'device_mismatch' });
      return;
    }
    const result = await applyHealthSync(
      claims.ownerId,
      input,
      createProductionHealthSyncRepository(config)
    );
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: 'invalid_input' });
      return;
    }
    if (error instanceof HealthSyncConflictError) {
      response.status(409).json({ error: 'idempotency_conflict' });
      return;
    }
    if (error instanceof Error && error.message === 'invalid_content_type') {
      response.status(415).json({ error: 'invalid_content_type' });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

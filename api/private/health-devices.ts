import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createHealthDeviceLabel,
  issueHealthSyncCredential,
  listHealthSyncCredentials,
  loadHealthSyncConfig,
  revokeHealthSyncCredential
} from '../../server/health-sync/index.js';
import {
  assertSameOriginJsonMutation,
  requireFamilySession
} from '../../server/family-auth/index.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, POST, DELETE');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const { config: familyConfig, session } = await requireFamilySession(request);
    const config = loadHealthSyncConfig();
    if (request.method === 'GET') {
      response.status(200).json({
        devices: await listHealthSyncCredentials(session.ownerId, config)
      });
      return;
    }

    assertSameOriginJsonMutation(request, familyConfig);
    if (request.method === 'POST') {
      const deviceInstallationId =
        typeof request.body?.device_installation_id === 'string'
          ? request.body.device_installation_id
          : '';
      const label =
        typeof request.body?.label === 'string'
          ? request.body.label
          : createHealthDeviceLabel(request.headers['user-agent']);
      response.status(201).json({
        device: await issueHealthSyncCredential(
          session.ownerId,
          deviceInstallationId,
          label,
          config
        )
      });
      return;
    }

    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    if (!(await revokeHealthSyncCredential(session.ownerId, id, config))) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    response.status(200).json({ revoked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'unauthorized') {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (message === 'forbidden') {
      response.status(403).json({ error: 'forbidden' });
      return;
    }
    if (message === 'invalid_content_type') {
      response.status(415).json({ error: 'invalid_content_type' });
      return;
    }
    if (
      ['credential_limit', 'invalid_device_id', 'invalid_label'].includes(message)
    ) {
      response.status(400).json({ error: message });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

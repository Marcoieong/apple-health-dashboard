import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertSameOriginJsonMutation,
  createCredentialLabel,
  issueShortcutCredential,
  listShortcutCredentials,
  loadShortcutCredentialConfig,
  requireFamilySession,
  revokeShortcutCredential
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
    const config = loadShortcutCredentialConfig();
    if (request.method === 'GET') {
      response.status(200).json({
        credentials: await listShortcutCredentials(session.ownerId, config)
      });
      return;
    }
    assertSameOriginJsonMutation(request, familyConfig);
    if (request.method === 'POST') {
      const label =
        typeof request.body?.label === 'string'
          ? request.body.label
          : createCredentialLabel(request.headers['user-agent']);
      response.status(201).json({
        credential: await issueShortcutCredential(session.ownerId, label, config)
      });
      return;
    }
    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    if (!(await revokeShortcutCredential(session.ownerId, id, config))) {
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
    if (message === 'credential_limit' || message === 'invalid_label') {
      response.status(400).json({ error: message });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

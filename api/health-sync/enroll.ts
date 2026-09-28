import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertSameOriginFormMutation,
  loadFamilyAuthConfig,
  requireFamilySession
} from '../../server/family-auth/index.js';
import {
  buildHealthBridgeCallbackUrl,
  buildHealthBridgeEnrollmentPath,
  createHealthDeviceLabel,
  issueHealthSyncCredential,
  loadHealthSyncConfig,
  parseHealthBridgeEnrollmentInput,
  renderHealthBridgeEnrollmentPage
} from '../../server/health-sync/index.js';

function valuesFor(request: VercelRequest): Record<string, unknown> {
  if (request.method !== 'POST') return request.query;
  if (typeof request.body === 'string') {
    return Object.fromEntries(new URLSearchParams(request.body));
  }
  return request.body as Record<string, unknown>;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const enrollment = parseHealthBridgeEnrollmentInput(valuesFor(request));
    let authenticated: Awaited<ReturnType<typeof requireFamilySession>>;
    try {
      authenticated = await requireFamilySession(request);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'unauthorized') throw error;
      const returnTo = buildHealthBridgeEnrollmentPath(enrollment);
      response.redirect(
        302,
        `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      );
      return;
    }

    if (request.method === 'GET') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.status(200).send(renderHealthBridgeEnrollmentPage(enrollment));
      return;
    }

    assertSameOriginFormMutation(request, authenticated.config);
    const issued = await issueHealthSyncCredential(
      authenticated.session.ownerId,
      enrollment.deviceInstallationId,
      createHealthDeviceLabel(request.headers['user-agent']),
      loadHealthSyncConfig()
    );
    response.redirect(
      303,
      buildHealthBridgeCallbackUrl(
        enrollment,
        issued.token,
        loadFamilyAuthConfig().baseUrl
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'forbidden') {
      response.status(403).json({ error: 'forbidden' });
      return;
    }
    if (message === 'invalid_content_type') {
      response.status(415).json({ error: 'invalid_content_type' });
      return;
    }
    if (
      ['invalid_device_id', 'invalid_state', 'credential_limit'].includes(message)
    ) {
      response.status(400).json({ error: message });
      return;
    }
    response.status(503).json({ error: 'service_unavailable' });
  }
}

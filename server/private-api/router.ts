import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import {
  createHealthDeviceLabel,
  issueHealthSyncCredential,
  listHealthSyncCredentials,
  listPrivateHealthDays,
  listPrivateHealthSyncStatus,
  loadHealthSyncConfig,
  parseHealthDateRange,
  revokeHealthSyncCredential
} from '../health-sync/index.js';
import {
  getPrivateThumbnailAsset,
  listPrivateMeals,
  loadPrivateMealStorageConfig
} from '../meal-photo-mcp/index.js';
import {
  assertSameOriginJsonMutation,
  createCredentialLabel,
  createPhotoLocator,
  issueShortcutCredential,
  listShortcutCredentials,
  loadShortcutCredentialConfig,
  readPhotoLocator,
  requireFamilySession,
  revokeShortcutCredential
} from '../family-auth/index.js';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

type PrivateRouteHandler = (
  request: VercelRequest,
  response: VercelResponse
) => Promise<void>;

function getRoutePath(request: VercelRequest): string {
  const path = request.query.path;
  if (Array.isArray(path)) return path.join('/');
  return typeof path === 'string' ? path : '';
}

const healthDevicesHandler: PrivateRouteHandler = async (request, response) => {
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
};

const healthHandler: PrivateRouteHandler = async (request, response) => {
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
};

const healthSyncStatusHandler: PrivateRouteHandler = async (request, response) => {
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
};

const mealsHandler: PrivateRouteHandler = async (request, response) => {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const { config, session } = await requireFamilySession(request);
    const privateMeals = await listPrivateMeals(
      session.ownerId,
      loadPrivateMealStorageConfig()
    );
    const meals = await Promise.all(
      privateMeals.map(async ({ thumbnail, ...meal }) => ({
        ...meal,
        ...(thumbnail
          ? {
              thumbnail: {
                url: `/api/private/photo?token=${encodeURIComponent(
                  await createPhotoLocator(
                    { ownerId: session.ownerId, assetId: thumbnail.assetId },
                    config
                  )
                )}`,
                width: thumbnail.width,
                height: thumbnail.height
              }
            }
          : {})
      }))
    );
    response.status(200).json({ meals });
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    response.status(500).json({ error: 'internal_error' });
  }
};

const photoHandler: PrivateRouteHandler = async (request, response) => {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const { config, session } = await requireFamilySession(request);
    const token = Array.isArray(request.query.token)
      ? request.query.token[0]
      : request.query.token;
    if (!token) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }
    const locator = await readPhotoLocator(token, config);
    if (!locator || locator.ownerId !== session.ownerId) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const storage = loadPrivateMealStorageConfig();
    const asset = await getPrivateThumbnailAsset(
      session.ownerId,
      locator.assetId,
      storage
    );
    if (!asset) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const blob = await get(asset.objectKey, {
      access: 'private',
      token: storage.privateBlobToken,
      useCache: false
    });
    if (!blob || blob.statusCode !== 200) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    if (blob.blob.size > MAX_THUMBNAIL_BYTES) {
      response.status(413).json({ error: 'image_too_large' });
      return;
    }
    if (!SAFE_IMAGE_MIME_TYPES.has(asset.mimeType)) {
      response.status(415).json({ error: 'unsupported_image_type' });
      return;
    }

    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', bytes.byteLength);
    response.setHeader('Content-Disposition', 'inline');
    response.status(200).send(bytes);
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    response.status(500).json({ error: 'internal_error' });
  }
};

const shortcutCredentialsHandler: PrivateRouteHandler = async (
  request,
  response
) => {
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
};

const ROUTES: Readonly<Record<string, PrivateRouteHandler>> = {
  'health-devices': healthDevicesHandler,
  health: healthHandler,
  'health/sync-status': healthSyncStatusHandler,
  meals: mealsHandler,
  photo: photoHandler,
  'shortcut-credentials': shortcutCredentialsHandler
};

export async function handlePrivateApi(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const handler = ROUTES[getRoutePath(request)];
  if (!handler) {
    response.setHeader('Cache-Control', 'private, no-store');
    response.status(404).json({ error: 'not_found' });
    return;
  }
  await handler(request, response);
}

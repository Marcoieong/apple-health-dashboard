import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import {
  getPrivateThumbnailAsset,
  loadPrivateMealStorageConfig
} from '../../server/meal-photo-mcp/index.js';
import {
  readPhotoLocator,
  requireFamilySession
} from '../../server/family-auth/index.js';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
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
}

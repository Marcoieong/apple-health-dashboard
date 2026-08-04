import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listPrivateMeals,
  loadPrivateMealStorageConfig
} from '../../server/meal-photo-mcp/index.js';
import {
  createPhotoLocator,
  requireFamilySession
} from '../../server/family-auth/index.js';

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
}

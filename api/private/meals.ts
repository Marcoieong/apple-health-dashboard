import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listPrivateMeals,
  loadPrivateMealStorageConfig
} from '../../server/meal-photo-mcp/index.js';
import {
  extractShortcutBearerToken,
  isValidShortcutToken,
  loadShortcutRuntimeConfig
} from '../../server/meal-photo-mcp/shortcutAuth.js';

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

  let shortcutConfig;
  try {
    shortcutConfig = loadShortcutRuntimeConfig();
  } catch {
    response.status(503).json({ error: 'service_locked' });
    return;
  }

  const suppliedToken = extractShortcutBearerToken(
    request.headers.authorization
  );
  if (!isValidShortcutToken(suppliedToken, shortcutConfig.accessToken)) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const meals = await listPrivateMeals(
      shortcutConfig.ownerId,
      loadPrivateMealStorageConfig()
    );
    response.status(200).json({ meals });
  } catch {
    response.status(500).json({ error: 'internal_error' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createProductionRecordMealDependencies,
  IngestError,
  loadPrivateMealStorageConfig,
  recordShortcutMeal
} from '../../server/meal-photo-mcp/index.js';
import {
  extractShortcutBearerToken,
  isValidShortcutToken,
  loadShortcutRuntimeConfig
} from '../../server/meal-photo-mcp/shortcutAuth.js';

let dependencies:
  | ReturnType<typeof createProductionRecordMealDependencies>
  | undefined;

function getDependencies() {
  dependencies ??= createProductionRecordMealDependencies({
    ...loadPrivateMealStorageConfig(),
    attachmentHosts: []
  });
  return dependencies;
}

function errorStatus(error: IngestError): number {
  switch (error.code) {
    case 'unauthorized':
      return 401;
    case 'idempotency_conflict':
      return 409;
    case 'unsupported_image':
      return 415;
    case 'download_failed':
      return 502;
    default:
      return 400;
  }
}

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
    const result = await recordShortcutMeal(
      request.body,
      shortcutConfig.ownerId,
      getDependencies()
    );
    response.status(result.status === 'recorded' ? 201 : 200).json(result);
  } catch (error) {
    if (error instanceof IngestError) {
      response.status(errorStatus(error)).json({
        error: error.code,
        message: error.message
      });
      return;
    }
    response.status(500).json({ error: 'internal_error' });
  }
}

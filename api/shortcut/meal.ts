import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createProductionRecordMealDependencies,
  IngestError,
  loadPrivateMealStorageConfig,
  recordShortcutMeal
} from '../../server/meal-photo-mcp/index.js';
import {
  extractShortcutBearerToken,
} from '../../server/meal-photo-mcp/shortcutAuth.js';
import { resolveShortcutOwner } from '../../server/family-auth/index.js';

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

const ingestDiagnosticReasons = new Map<string, string>([
  ['Meal data is invalid.', 'meal_object'],
  ['A meal must contain one to four photos.', 'photos_array'],
  ['Idempotency key is invalid.', 'request_id'],
  ['Meal date must use YYYY-MM-DD.', 'local_date'],
  ['Timezone or meal type is invalid.', 'timezone_or_meal_type'],
  ['Food labels are invalid.', 'food_labels'],
  ['Preparation methods are invalid.', 'preparation_methods'],
  ['Meal note is too long.', 'notes'],
  ['Photo data is invalid.', 'photo_data_type'],
  ['Photo data is not valid Base64.', 'photo_base64'],
  ['Photo filename is unsafe.', 'photo_file_name'],
  ['Photo MIME type is invalid.', 'photo_mime_type']
]);

function ingestDiagnosticReason(error: IngestError): string {
  return ingestDiagnosticReasons.get(error.message) ?? 'other';
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

  const suppliedToken = extractShortcutBearerToken(
    request.headers.authorization
  );
  const ownerId = await resolveShortcutOwner(suppliedToken);
  if (!ownerId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const result = await recordShortcutMeal(
      request.body,
      ownerId,
      getDependencies()
    );
    response.status(result.status === 'recorded' ? 201 : 200).json(result);
  } catch (error) {
    if (error instanceof IngestError) {
      const diagnostic = ingestDiagnosticReason(error);
      // Do not log request bodies, authorization headers, image bytes, labels,
      // notes, or other private health data. This fixed code is safe to retain.
      console.warn('shortcut_ingest_rejected', {
        code: error.code,
        diagnostic
      });
      response.status(errorStatus(error)).json({
        error: error.code,
        diagnostic,
        message: error.message
      });
      return;
    }
    response.status(500).json({ error: 'internal_error' });
  }
}

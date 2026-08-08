import type { VercelRequest } from '@vercel/node';
import { loadFamilyAuthConfig } from './config.js';
import { readFamilySession } from './session.js';

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function assertSameOriginJsonMutation(
  request: VercelRequest,
  config: ReturnType<typeof loadFamilyAuthConfig>
): void {
  const method = request.method?.toUpperCase();
  if (!method || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

  const origin = singleHeader(request.headers.origin);
  const fetchSite = singleHeader(request.headers['sec-fetch-site']);
  const contentType = singleHeader(request.headers['content-type']) ?? '';

  if (fetchSite && fetchSite !== 'same-origin') throw new Error('forbidden');
  if (!origin) throw new Error('forbidden');
  try {
    if (new URL(origin).origin !== config.baseUrl.origin) {
      throw new Error('forbidden');
    }
  } catch {
    throw new Error('forbidden');
  }
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('invalid_content_type');
  }
}

export function assertSameOriginFormMutation(
  request: VercelRequest,
  config: ReturnType<typeof loadFamilyAuthConfig>
): void {
  const origin = singleHeader(request.headers.origin);
  const fetchSite = singleHeader(request.headers['sec-fetch-site']);
  const contentType = singleHeader(request.headers['content-type']) ?? '';

  if (fetchSite && fetchSite !== 'same-origin') throw new Error('forbidden');
  if (!origin) throw new Error('forbidden');
  try {
    if (new URL(origin).origin !== config.baseUrl.origin) {
      throw new Error('forbidden');
    }
  } catch {
    throw new Error('forbidden');
  }
  if (
    !contentType
      .toLowerCase()
      .startsWith('application/x-www-form-urlencoded')
  ) {
    throw new Error('invalid_content_type');
  }
}

export async function requireFamilySession(request: VercelRequest) {
  const config = loadFamilyAuthConfig();
  const session = await readFamilySession(request.headers.cookie, config);
  if (!session) throw new Error('unauthorized');
  return { config, session };
}

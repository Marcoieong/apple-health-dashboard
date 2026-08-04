import type { VercelRequest } from '@vercel/node';
import { loadFamilyAuthConfig } from './config.js';
import { readFamilySession } from './session.js';

export async function requireFamilySession(request: VercelRequest) {
  const config = loadFamilyAuthConfig();
  const session = await readFamilySession(request.headers.cookie, config);
  if (!session) throw new Error('unauthorized');
  return { config, session };
}

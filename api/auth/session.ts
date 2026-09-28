import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadFamilyAuthConfig, readFamilySession } from '../../server/family-auth/index.js';

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
    const config = loadFamilyAuthConfig();
    const session = await readFamilySession(request.headers.cookie, config);
    if (!session) {
      response.status(200).json({ authenticated: false });
      return;
    }
    response.status(200).json({
      authenticated: true,
      member: {
        email: session.email,
        ...(session.name ? { name: session.name } : {}),
        isAdmin: session.isAdmin
      }
    });
  } catch {
    response.status(200).json({ authenticated: false });
  }
}

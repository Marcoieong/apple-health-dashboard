import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookie, loadFamilyAuthConfig } from '../../server/family-auth/index.js';

export default function handler(
  request: VercelRequest,
  response: VercelResponse
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    response.setHeader('Set-Cookie', clearSessionCookie(loadFamilyAuthConfig()));
  } catch {
    // An unavailable auth configuration must not prevent a local cookie clear.
    response.setHeader(
      'Set-Cookie',
      'health-family-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );
  }
  response.redirect(302, '/?section=food-journal');
}

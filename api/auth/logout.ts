import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAllSessionCookies } from '../../server/family-auth/index.js';

export default function handler(
  request: VercelRequest,
  response: VercelResponse
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  response.setHeader('Set-Cookie', clearAllSessionCookies());
  response.redirect(302, '/?section=food-journal');
}

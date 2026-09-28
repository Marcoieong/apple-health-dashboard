import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  beginAuth0Login,
  createTransactionCookie,
  loadFamilyAuthConfig
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
    const config = loadFamilyAuthConfig();
    const returnTo = typeof request.query.returnTo === 'string'
      ? request.query.returnTo
      : '/?section=food-journal';
    const { authorizationUrl, transaction } = beginAuth0Login(config, returnTo);
    response.setHeader(
      'Set-Cookie',
      await createTransactionCookie(transaction, config)
    );
    response.redirect(302, authorizationUrl.href);
  } catch {
    response.status(503).json({ error: 'family_login_unavailable' });
  }
}

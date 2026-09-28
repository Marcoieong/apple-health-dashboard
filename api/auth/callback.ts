import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearTransactionCookie,
  completeAuth0Login,
  createSessionCookie,
  loadFamilyAuthConfig,
  readAuthTransaction
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
    const transaction = await readAuthTransaction(request.headers.cookie, config);
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    const state = typeof request.query.state === 'string' ? request.query.state : '';
    if (!transaction || !code || !state) throw new Error('Missing callback state.');
    const session = await completeAuth0Login(
      config,
      transaction,
      code,
      state
    );
    response.setHeader('Set-Cookie', [
      await createSessionCookie(session, config),
      clearTransactionCookie(config)
    ]);
    response.redirect(302, transaction.returnTo);
  } catch {
    response.redirect(302, '/?auth=failed&section=food-journal');
  }
}

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FamilyAuthConfig } from './config.js';
import {
  deriveFamilyOwnerId,
  isAllowedFamilyEmail,
  normalizeEmail
} from './config.js';
import type { AuthTransaction, FamilySession } from './session.js';

export interface Auth0LoginStart {
  authorizationUrl: URL;
  transaction: AuthTransaction;
}

function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function safeReturnTo(value: string | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function beginAuth0Login(
  config: FamilyAuthConfig,
  requestedReturnTo?: string
): Auth0LoginStart {
  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const codeVerifier = randomBase64Url(48);
  const authorizationUrl = new URL('authorize', config.issuer);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set(
    'redirect_uri',
    new URL('/api/auth/callback', config.baseUrl).href
  );
  authorizationUrl.searchParams.set('scope', 'openid profile email');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set(
    'code_challenge',
    createHash('sha256').update(codeVerifier).digest('base64url')
  );

  return {
    authorizationUrl,
    transaction: {
      state,
      nonce,
      codeVerifier,
      returnTo: safeReturnTo(requestedReturnTo)
    }
  };
}

export async function completeAuth0Login(
  config: FamilyAuthConfig,
  transaction: AuthTransaction,
  code: string,
  state: string,
  fetchImplementation: typeof fetch = fetch
): Promise<FamilySession> {
  if (!sameSecret(transaction.state, state)) {
    throw new Error('OAuth state mismatch.');
  }
  const tokenResponse = await fetchImplementation(new URL('oauth/token', config.issuer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: transaction.codeVerifier,
      redirect_uri: new URL('/api/auth/callback', config.baseUrl).href
    })
  });
  if (!tokenResponse.ok) throw new Error('Auth0 code exchange failed.');
  const tokenBody = (await tokenResponse.json()) as { id_token?: unknown };
  if (typeof tokenBody.id_token !== 'string') {
    throw new Error('Auth0 did not return an ID token.');
  }

  const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', config.issuer));
  const { payload } = await jwtVerify(tokenBody.id_token, jwks, {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ['RS256']
  });
  if (
    payload.nonce !== transaction.nonce ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    payload.email_verified !== true
  ) {
    throw new Error('Auth0 identity claims are incomplete.');
  }
  const email = normalizeEmail(payload.email);
  if (!isAllowedFamilyEmail(config, email)) {
    throw new Error('This family account has not been invited.');
  }
  return {
    subject: payload.sub,
    ownerId: deriveFamilyOwnerId(config, payload.sub, email),
    email,
    ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
    isAdmin: email === config.adminEmail
  };
}

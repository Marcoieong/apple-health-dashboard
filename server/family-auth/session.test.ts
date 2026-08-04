// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { loadFamilyAuthConfig } from './config.js';
import {
  createPhotoLocator,
  createSessionCookie,
  createTransactionCookie,
  readAuthTransaction,
  readFamilySession,
  readPhotoLocator
} from './session.js';

function config(baseUrl = 'https://preview.example.com') {
  return loadFamilyAuthConfig({
    AUTH0_WEB_ISSUER: 'https://family-test.auth0.com',
    AUTH0_WEB_CLIENT_ID: 'family-client',
    AUTH0_WEB_CLIENT_SECRET: 'c'.repeat(32),
    AUTH0_WEB_BASE_URL: baseUrl,
    AUTH0_WEB_ALLOWED_EMAILS: 'marco@pui-pui.org',
    AUTH0_WEB_ADMIN_EMAIL: 'marco@pui-pui.org',
    WEB_SESSION_SECRET: 's'.repeat(32),
    AUTH0_WEB_OWNER_HMAC_SECRET: 'o'.repeat(32)
  });
}

function tamperCompactJwe(token: string): string {
  const parts = token.split('.');
  const ciphertext = parts[3];
  if (!ciphertext) throw new Error('Expected a compact JWE ciphertext.');
  parts[3] = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
  return parts.join('.');
}

function tamperCookieToken(cookie: string): string {
  const valueStart = cookie.indexOf('=') + 1;
  const valueEnd = cookie.indexOf(';', valueStart);
  if (valueStart === 0 || valueEnd < 0) throw new Error('Expected a serialized cookie.');
  return `${cookie.slice(0, valueStart)}${tamperCompactJwe(
    cookie.slice(valueStart, valueEnd)
  )}${cookie.slice(valueEnd)}`;
}

describe('family encrypted browser state', () => {
  it('round-trips a secure server-only family session', async () => {
    const authConfig = config();
    const cookie = await createSessionCookie(
      {
        subject: 'auth0|marco',
        ownerId: 'marco-owner',
        email: 'marco@pui-pui.org',
        name: 'Marco',
        isAdmin: true
      },
      authConfig
    );

    expect(cookie).toContain('__Host-health-family-session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    await expect(readFamilySession(cookie, authConfig)).resolves.toEqual({
      subject: 'auth0|marco',
      ownerId: 'marco-owner',
      email: 'marco@pui-pui.org',
      name: 'Marco',
      isAdmin: true
    });
  });

  it('rejects tampered or differently encrypted session cookies', async () => {
    const authConfig = config();
    const cookie = await createSessionCookie(
      {
        subject: 'auth0|member',
        ownerId: 'member-owner',
        email: 'member@example.com',
        isAdmin: false
      },
      authConfig
    );
    const tampered = tamperCookieToken(cookie);

    await expect(readFamilySession(tampered, authConfig)).resolves.toBeUndefined();
    await expect(
      readFamilySession(
        cookie,
        loadFamilyAuthConfig({
          AUTH0_WEB_ISSUER: 'https://family-test.auth0.com',
          AUTH0_WEB_CLIENT_ID: 'family-client',
          AUTH0_WEB_CLIENT_SECRET: 'c'.repeat(32),
          AUTH0_WEB_BASE_URL: 'https://preview.example.com',
          AUTH0_WEB_ALLOWED_EMAILS: 'marco@pui-pui.org',
          AUTH0_WEB_ADMIN_EMAIL: 'marco@pui-pui.org',
          WEB_SESSION_SECRET: 'different-session-secret-value-12345',
          AUTH0_WEB_OWNER_HMAC_SECRET: 'o'.repeat(32)
        })
      )
    ).resolves.toBeUndefined();
  });

  it('keeps OAuth transaction values encrypted and sanitizes through the caller', async () => {
    const authConfig = config('http://localhost:5173');
    const transaction = {
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value',
      returnTo: '/?section=food-journal'
    };
    const cookie = await createTransactionCookie(transaction, authConfig);

    expect(cookie).not.toContain('__Host-');
    expect(cookie).not.toContain('Secure');
    expect(cookie).not.toContain('state-value');
    await expect(readAuthTransaction(cookie, authConfig)).resolves.toEqual(
      transaction
    );
  });

  it('binds a short-lived photo locator to its owner and asset', async () => {
    const authConfig = config();
    const token = await createPhotoLocator(
      { ownerId: 'member-a', assetId: 'asset-a' },
      authConfig
    );

    await expect(readPhotoLocator(token, authConfig)).resolves.toEqual({
      ownerId: 'member-a',
      assetId: 'asset-a'
    });
    await expect(readPhotoLocator(tamperCompactJwe(token), authConfig)).resolves.toBeUndefined();
  });
});

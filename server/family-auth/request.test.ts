// @vitest-environment node

import type { VercelRequest } from '@vercel/node';
import { describe, expect, it } from 'vitest';
import { loadFamilyAuthConfig } from './config.js';
import {
  assertSameOriginFormMutation,
  assertSameOriginJsonMutation
} from './request.js';

const config = loadFamilyAuthConfig({
  AUTH0_WEB_ISSUER: 'https://family-test.auth0.com',
  AUTH0_WEB_CLIENT_ID: 'family-client',
  AUTH0_WEB_CLIENT_SECRET: 'c'.repeat(32),
  AUTH0_WEB_BASE_URL: 'https://health.pui-pui.org',
  AUTH0_WEB_ALLOWED_EMAILS: 'marco@pui-pui.org',
  AUTH0_WEB_ADMIN_EMAIL: 'marco@pui-pui.org',
  WEB_SESSION_SECRET: 's'.repeat(32),
  AUTH0_WEB_OWNER_HMAC_SECRET: 'o'.repeat(32)
});

function request(headers: VercelRequest['headers']): VercelRequest {
  return { method: 'POST', headers } as VercelRequest;
}

describe('same-origin JSON mutation guard', () => {
  it('accepts a same-origin JSON browser request', () => {
    expect(() =>
      assertSameOriginJsonMutation(
        request({
          origin: 'https://health.pui-pui.org',
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json; charset=utf-8'
        }),
        config
      )
    ).not.toThrow();
  });

  it.each([
    [{ 'content-type': 'application/json' }, 'forbidden'],
    [
      {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json'
      },
      'forbidden'
    ],
    [
      {
        origin: 'https://health.pui-pui.org',
        'sec-fetch-site': 'same-origin',
        'content-type': 'text/plain'
      },
      'invalid_content_type'
    ]
  ])('rejects an unsafe mutation', (headers, message) => {
    expect(() =>
      assertSameOriginJsonMutation(request(headers), config)
    ).toThrow(message);
  });
});

describe('same-origin form mutation guard', () => {
  it('accepts the HealthBridge consent form', () => {
    expect(() =>
      assertSameOriginFormMutation(
        request({
          origin: 'https://health.pui-pui.org',
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/x-www-form-urlencoded'
        }),
        config
      )
    ).not.toThrow();
  });

  it.each([
    [{ 'content-type': 'application/x-www-form-urlencoded' }, 'forbidden'],
    [
      {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/x-www-form-urlencoded'
      },
      'forbidden'
    ],
    [
      {
        origin: 'https://health.pui-pui.org',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json'
      },
      'invalid_content_type'
    ]
  ])('rejects an unsafe form mutation', (headers, message) => {
    expect(() =>
      assertSameOriginFormMutation(request(headers), config)
    ).toThrow(message);
  });
});

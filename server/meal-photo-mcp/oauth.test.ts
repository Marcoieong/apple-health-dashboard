import { describe, expect, it } from 'vitest';
import type { JWTPayload } from 'jose';
import {
  buildWwwAuthenticate,
  extractBearerToken,
  extractScopes
} from './oauth.js';
import type { ChatGptMcpRuntimeConfig } from './runtimeConfig.js';

describe('ChatGPT MCP OAuth helpers', () => {
  it('accepts one strict Bearer token and rejects ambiguous headers', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer token')).toBe('token');
    expect(extractBearerToken('Basic token')).toBeUndefined();
    expect(extractBearerToken(['Bearer one', 'Bearer two'])).toBeUndefined();
    expect(extractBearerToken('Bearer one two')).toBeUndefined();
  });

  it('combines OAuth scope and scp claims without duplicates', () => {
    const payload = {
      scope: 'openid meal.write',
      scp: ['meal.write', 'profile', 123]
    } as JWTPayload;

    expect(extractScopes(payload)).toEqual([
      'openid',
      'meal.write',
      'profile'
    ]);
  });

  it('advertises the protected-resource metadata and least-privilege scopes', () => {
    const config: ChatGptMcpRuntimeConfig = {
      resourceUrl: new URL('https://health.pui-pui.org/mcp'),
      authorizationServer: new URL('https://login.example.com/'),
      issuer: 'https://login.example.com/',
      audience: 'https://health.pui-pui.org/api/mcp',
      jwksUri: new URL('https://login.example.com/jwks.json'),
      ownerId: 'existing-marco-owner',
      allowedSubject: 'auth0|owner'
    };

    expect(buildWwwAuthenticate(config)).toBe(
      'Bearer resource_metadata="https://health.pui-pui.org/.well-known/oauth-protected-resource", scope="health.read meal.write"'
    );
  });
});

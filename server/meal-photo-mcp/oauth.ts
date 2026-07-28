import { createHmac } from 'node:crypto';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload
} from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  MEAL_WRITE_SCOPE,
  type ChatGptMcpRuntimeConfig
} from './runtimeConfig.js';

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getRemoteJwks(url: URL): ReturnType<typeof createRemoteJWKSet> {
  const key = url.href;
  const existing = jwksByUrl.get(key);
  if (existing) {
    return existing;
  }
  const created = createRemoteJWKSet(url);
  jwksByUrl.set(key, created);
  return created;
}

export function extractBearerToken(
  authorization: string | string[] | undefined
): string | undefined {
  if (typeof authorization !== 'string') {
    return undefined;
  }
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorization);
  return match?.[1];
}

export function extractScopes(payload: JWTPayload): string[] {
  const scopes = new Set<string>();
  if (typeof payload.scope === 'string') {
    payload.scope
      .split(/\s+/)
      .filter(Boolean)
      .forEach((scope) => scopes.add(scope));
  }
  const scp = payload.scp;
  if (Array.isArray(scp)) {
    scp
      .filter((scope): scope is string => typeof scope === 'string')
      .forEach((scope) => scopes.add(scope));
  }
  return [...scopes];
}

function ownerIdFor(
  issuer: string,
  subject: string,
  secret: string
): string {
  return createHmac('sha256', secret)
    .update(`${issuer}\0${subject}`)
    .digest('hex');
}

function clientIdFor(payload: JWTPayload): string {
  if (typeof payload.client_id === 'string') {
    return payload.client_id;
  }
  if (typeof payload.azp === 'string') {
    return payload.azp;
  }
  return 'chatgpt';
}

export async function verifyMcpAccessToken(
  token: string,
  config: ChatGptMcpRuntimeConfig
): Promise<AuthInfo> {
  const verified = await jwtVerify(token, getRemoteJwks(config.jwksUri), {
    issuer: config.issuer,
    audience: config.audience
  });
  const subject = verified.payload.sub;
  if (!subject) {
    throw new Error('Access token has no subject.');
  }
  if (subject !== config.allowedSubject) {
    throw new Error('Access token subject is not the configured owner.');
  }

  const scopes = extractScopes(verified.payload);
  if (!scopes.includes(MEAL_WRITE_SCOPE)) {
    throw new Error('Access token is missing meal.write.');
  }

  return {
    token,
    clientId: clientIdFor(verified.payload),
    scopes,
    expiresAt: verified.payload.exp,
    resource: config.resourceUrl,
    extra: {
      ownerId: ownerIdFor(config.issuer, subject, config.ownerHmacSecret)
    }
  };
}

export function buildWwwAuthenticate(config: ChatGptMcpRuntimeConfig): string {
  const metadataUrl = new URL(
    '/.well-known/oauth-protected-resource',
    config.resourceUrl
  );
  return `Bearer resource_metadata="${metadataUrl.href}", scope="${MEAL_WRITE_SCOPE}"`;
}

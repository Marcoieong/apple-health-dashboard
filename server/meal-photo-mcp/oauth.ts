import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload
} from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  SUPPORTED_MCP_SCOPES,
  type ChatGptMcpRuntimeConfig
} from './runtimeConfig.js';

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type McpAccessTokenDiagnostic =
  | 'jwt_issuer_mismatch'
  | 'jwt_audience_mismatch'
  | 'jwt_expired'
  | 'jwt_signature_invalid'
  | 'jwt_verification_failed'
  | 'missing_subject'
  | 'subject_mismatch'
  | 'missing_health_scope'
  | 'unexpected_error';

export class McpAccessTokenError extends Error {
  readonly diagnostic: McpAccessTokenDiagnostic;

  constructor(diagnostic: McpAccessTokenDiagnostic, cause?: unknown) {
    super('MCP access token rejected.');
    this.name = 'McpAccessTokenError';
    this.diagnostic = diagnostic;
    this.cause = cause;
  }
}

function objectProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return Reflect.get(value, key);
}

export function classifyJwtVerificationError(
  error: unknown
): McpAccessTokenDiagnostic {
  const code = objectProperty(error, 'code');
  const claim = objectProperty(error, 'claim');

  if (claim === 'iss') {
    return 'jwt_issuer_mismatch';
  }
  if (claim === 'aud') {
    return 'jwt_audience_mismatch';
  }
  if (code === 'ERR_JWT_EXPIRED') {
    return 'jwt_expired';
  }
  if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
    return 'jwt_signature_invalid';
  }
  return 'jwt_verification_failed';
}

export function getMcpAccessTokenDiagnostic(
  error: unknown
): McpAccessTokenDiagnostic {
  return error instanceof McpAccessTokenError
    ? error.diagnostic
    : 'unexpected_error';
}

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
  let verified;
  try {
    verified = await jwtVerify(token, getRemoteJwks(config.jwksUri), {
      issuer: config.issuer,
      audience: config.audience
    });
  } catch (error) {
    throw new McpAccessTokenError(
      classifyJwtVerificationError(error),
      error
    );
  }
  const subject = verified.payload.sub;
  if (!subject) {
    throw new McpAccessTokenError('missing_subject');
  }
  if (subject !== config.allowedSubject) {
    throw new McpAccessTokenError('subject_mismatch');
  }

  const scopes = extractScopes(verified.payload);
  if (!SUPPORTED_MCP_SCOPES.some((scope) => scopes.includes(scope))) {
    throw new McpAccessTokenError('missing_health_scope');
  }

  return {
    token,
    clientId: clientIdFor(verified.payload),
    scopes,
    expiresAt: verified.payload.exp,
    resource: config.resourceUrl,
    extra: {
      ownerId: config.ownerId
    }
  };
}

export interface WwwAuthenticateError {
  error: 'invalid_token' | 'insufficient_scope';
  errorDescription: string;
}

function quoteAuthParameter(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildWwwAuthenticate(
  config: ChatGptMcpRuntimeConfig,
  authError?: WwwAuthenticateError
): string {
  const metadataUrl = new URL(
    '/.well-known/oauth-protected-resource',
    config.resourceUrl
  );
  const parameters = [
    `resource_metadata="${quoteAuthParameter(metadataUrl.href)}"`,
    `scope="${SUPPORTED_MCP_SCOPES.join(' ')}"`
  ];
  if (authError) {
    parameters.push(
      `error="${authError.error}"`,
      `error_description="${quoteAuthParameter(authError.errorDescription)}"`
    );
  }
  return `Bearer ${parameters.join(', ')}`;
}

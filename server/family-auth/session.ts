import { EncryptJWT, jwtDecrypt } from 'jose';
import type { FamilyAuthConfig } from './config.js';
import { isSecureFamilyOrigin } from './config.js';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TRANSACTION_TTL_SECONDS = 10 * 60;
const PHOTO_TTL_SECONDS = 20 * 60;

export interface FamilySession {
  subject: string;
  ownerId: string;
  email: string;
  name?: string;
  isAdmin: boolean;
}

export interface AuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

export interface PhotoLocator {
  ownerId: string;
  assetId: string;
}

function cookieName(base: string, config: FamilyAuthConfig): string {
  return `${isSecureFamilyOrigin(config) ? '__Host-' : ''}${base}`;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function serializeCookie(
  name: string,
  value: string,
  config: FamilyAuthConfig,
  maxAge: number
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(isSecureFamilyOrigin(config) ? ['Secure'] : []),
    `Max-Age=${maxAge}`
  ].join('; ');
}

async function seal(
  type: string,
  payload: Record<string, unknown>,
  config: FamilyAuthConfig,
  expiresIn: number
): Promise<string> {
  return new EncryptJWT({ ...payload, typ: type })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .encrypt(config.sessionKey);
}

async function open(
  token: string,
  expectedType: string,
  config: FamilyAuthConfig
): Promise<Record<string, unknown>> {
  const { payload } = await jwtDecrypt(token, config.sessionKey, {
    clockTolerance: 5
  });
  if (payload.typ !== expectedType) throw new Error('Unexpected token type.');
  return payload;
}

export async function createSessionCookie(
  session: FamilySession,
  config: FamilyAuthConfig
): Promise<string> {
  const token = await seal(
    'family-session',
    {
      sub: session.subject,
      oid: session.ownerId,
      email: session.email,
      ...(session.name ? { name: session.name } : {}),
      admin: session.isAdmin
    },
    config,
    SESSION_TTL_SECONDS
  );
  return serializeCookie(
    cookieName('health-family-session', config),
    token,
    config,
    SESSION_TTL_SECONDS
  );
}

export async function readFamilySession(
  cookieHeader: string | undefined,
  config: FamilyAuthConfig
): Promise<FamilySession | undefined> {
  const token = cookieValue(
    cookieHeader,
    cookieName('health-family-session', config)
  );
  if (!token) return undefined;
  try {
    const payload = await open(token, 'family-session', config);
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.oid !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.admin !== 'boolean'
    ) {
      return undefined;
    }
    return {
      subject: payload.sub,
      ownerId: payload.oid,
      email: payload.email,
      ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
      isAdmin: payload.admin
    };
  } catch {
    return undefined;
  }
}

export function clearSessionCookie(config: FamilyAuthConfig): string {
  return serializeCookie(
    cookieName('health-family-session', config),
    '',
    config,
    0
  );
}

export async function createTransactionCookie(
  transaction: AuthTransaction,
  config: FamilyAuthConfig
): Promise<string> {
  const token = await seal(
    'auth-transaction',
    {
      state: transaction.state,
      nonce: transaction.nonce,
      verifier: transaction.codeVerifier,
      returnTo: transaction.returnTo
    },
    config,
    TRANSACTION_TTL_SECONDS
  );
  return serializeCookie(
    cookieName('health-family-auth', config),
    token,
    config,
    TRANSACTION_TTL_SECONDS
  );
}

export async function readAuthTransaction(
  cookieHeader: string | undefined,
  config: FamilyAuthConfig
): Promise<AuthTransaction | undefined> {
  const token = cookieValue(
    cookieHeader,
    cookieName('health-family-auth', config)
  );
  if (!token) return undefined;
  try {
    const payload = await open(token, 'auth-transaction', config);
    if (
      typeof payload.state !== 'string' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.verifier !== 'string' ||
      typeof payload.returnTo !== 'string'
    ) {
      return undefined;
    }
    return {
      state: payload.state,
      nonce: payload.nonce,
      codeVerifier: payload.verifier,
      returnTo: payload.returnTo
    };
  } catch {
    return undefined;
  }
}

export function clearTransactionCookie(config: FamilyAuthConfig): string {
  return serializeCookie(
    cookieName('health-family-auth', config),
    '',
    config,
    0
  );
}

export async function createPhotoLocator(
  locator: PhotoLocator,
  config: FamilyAuthConfig
): Promise<string> {
  return seal(
    'photo-locator',
    { oid: locator.ownerId, aid: locator.assetId },
    config,
    PHOTO_TTL_SECONDS
  );
}

export async function readPhotoLocator(
  token: string,
  config: FamilyAuthConfig
): Promise<PhotoLocator | undefined> {
  try {
    const payload = await open(token, 'photo-locator', config);
    if (typeof payload.oid !== 'string' || typeof payload.aid !== 'string') {
      return undefined;
    }
    return { ownerId: payload.oid, assetId: payload.aid };
  } catch {
    return undefined;
  }
}

import { createHash, createHmac } from 'node:crypto';

export interface FamilyAuthConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  baseUrl: URL;
  allowedEmails: ReadonlySet<string>;
  adminEmail: string;
  sessionKey: Uint8Array;
  ownerHmacSecret: string;
  legacyOwner?: {
    email: string;
    ownerId: string;
  };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function requireValue(
  env: NodeJS.ProcessEnv,
  name: string,
  minimumLength = 1
): string {
  const value = env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} is missing or too short.`);
  }
  return value;
}

function parseHttpsUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  const localHttp =
    url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
  return url;
}

function parseAllowedEmails(value: string): ReadonlySet<string> {
  const emails = value
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  if (
    emails.length === 0 ||
    emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    throw new Error('AUTH0_WEB_ALLOWED_EMAILS must contain valid email addresses.');
  }
  return new Set(emails);
}

export function loadFamilyAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): FamilyAuthConfig {
  const issuerUrl = parseHttpsUrl(
    requireValue(env, 'AUTH0_WEB_ISSUER'),
    'AUTH0_WEB_ISSUER'
  );
  issuerUrl.pathname = issuerUrl.pathname.replace(/\/*$/, '/');
  const baseUrl = parseHttpsUrl(
    requireValue(env, 'AUTH0_WEB_BASE_URL'),
    'AUTH0_WEB_BASE_URL'
  );
  baseUrl.pathname = '/';
  baseUrl.search = '';
  baseUrl.hash = '';

  const allowedEmails = parseAllowedEmails(
    requireValue(env, 'AUTH0_WEB_ALLOWED_EMAILS')
  );
  const adminEmail = normalizeEmail(requireValue(env, 'AUTH0_WEB_ADMIN_EMAIL'));
  if (!allowedEmails.has(adminEmail)) {
    throw new Error('AUTH0_WEB_ADMIN_EMAIL must be in AUTH0_WEB_ALLOWED_EMAILS.');
  }

  const legacyEmailValue = env.AUTH0_WEB_LEGACY_OWNER_EMAIL?.trim();
  const legacyOwnerId = env.AUTH0_WEB_LEGACY_OWNER_ID?.trim();
  if (Boolean(legacyEmailValue) !== Boolean(legacyOwnerId)) {
    throw new Error('Legacy owner email and owner ID must be configured together.');
  }
  const legacyEmail = legacyEmailValue
    ? normalizeEmail(legacyEmailValue)
    : undefined;
  if (legacyEmail && !allowedEmails.has(legacyEmail)) {
    throw new Error('Legacy owner email must be in AUTH0_WEB_ALLOWED_EMAILS.');
  }
  if (legacyOwnerId && legacyOwnerId.length > 128) {
    throw new Error('AUTH0_WEB_LEGACY_OWNER_ID is too long.');
  }

  return {
    issuer: issuerUrl.href,
    clientId: requireValue(env, 'AUTH0_WEB_CLIENT_ID'),
    clientSecret: requireValue(env, 'AUTH0_WEB_CLIENT_SECRET', 16),
    baseUrl,
    allowedEmails,
    adminEmail,
    sessionKey: new Uint8Array(
      createHash('sha256')
        .update(requireValue(env, 'WEB_SESSION_SECRET', 32))
        .digest()
    ),
    ownerHmacSecret: requireValue(env, 'AUTH0_WEB_OWNER_HMAC_SECRET', 32),
    ...(legacyEmail && legacyOwnerId
      ? { legacyOwner: { email: legacyEmail, ownerId: legacyOwnerId } }
      : {})
  };
}

export function isAllowedFamilyEmail(
  config: FamilyAuthConfig,
  email: string
): boolean {
  return config.allowedEmails.has(normalizeEmail(email));
}

export function deriveFamilyOwnerId(
  config: FamilyAuthConfig,
  subject: string,
  email: string
): string {
  const normalizedEmail = normalizeEmail(email);
  if (config.legacyOwner?.email === normalizedEmail) {
    return config.legacyOwner.ownerId;
  }
  return `family_${createHmac('sha256', config.ownerHmacSecret)
    // The Auth0 subject is the durable account identifier. Email is used only
    // for the invitation gate and must not change a member's data owner ID.
    .update(['family-owner-v1', config.issuer, subject].join('\0'))
    .digest('base64url')}`;
}

export function isSecureFamilyOrigin(config: FamilyAuthConfig): boolean {
  return config.baseUrl.protocol === 'https:';
}

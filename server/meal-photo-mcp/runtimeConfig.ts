export const MEAL_WRITE_SCOPE = 'meal.write';
export const HEALTH_READ_SCOPE = 'health.read';
// The ChatGPT connector is deliberately read-only. Meal ingestion remains a
// separate capability and must never be advertised by this protected resource.
export const SUPPORTED_MCP_SCOPES = [HEALTH_READ_SCOPE] as const;

export interface ChatGptMcpRuntimeConfig {
  resourceUrl: URL;
  authorizationServer: URL;
  issuer: string;
  audience: string;
  jwksUri: URL;
  ownerId: string;
  allowedSubject: string;
}

export interface PrivateMealStorageConfig {
  databaseUrl: string;
  privateBlobToken: string;
  ingestHmacSecret: string;
}

export interface ChatGptMcpStorageConfig extends PrivateMealStorageConfig {
  attachmentHosts: readonly string[];
}

export interface ChatGptMcpReadiness {
  state: 'locked' | 'auth_ready' | 'ready';
  authConfigured: boolean;
  healthReadConfigured: boolean;
  privateStorageConfigured: boolean;
  mealWriteConfigured: boolean;
  ingestAdaptersImplemented: boolean;
  publicWriteEnabled: false;
}

const requiredAuthVariables = [
  'CHATGPT_MCP_RESOURCE_URL',
  'CHATGPT_MCP_AUTHORIZATION_SERVER',
  'CHATGPT_MCP_ISSUER',
  'CHATGPT_MCP_AUDIENCE',
  'CHATGPT_MCP_JWKS_URI',
  'CHATGPT_MCP_ALLOWED_SUBJECT'
] as const;

const requiredPrivateStorageVariables = [
  'BLOB_READ_WRITE_TOKEN',
  'CHATGPT_MCP_INGEST_HMAC_SECRET'
] as const;

const requiredChatGptStorageVariables = [
  ...requiredPrivateStorageVariables,
  'CHATGPT_MCP_ATTACHMENT_HOSTS'
] as const;

const hasAll = (
  env: NodeJS.ProcessEnv,
  names: readonly string[]
): boolean => names.every((name) => Boolean(env[name]?.trim()));

function getDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.DATABASE_URL?.trim() || env.CHATGPT_MCP_DATABASE_URL?.trim();
}

function getOwnerId(env: NodeJS.ProcessEnv): string | undefined {
  return (
    env.CHATGPT_MCP_OWNER_ID?.trim() ||
    env.AUTH0_WEB_LEGACY_OWNER_ID?.trim()
  );
}

function hasCompleteAuth(env: NodeJS.ProcessEnv): boolean {
  return hasAll(env, requiredAuthVariables) && Boolean(getOwnerId(env));
}

function secureUrl(value: string | undefined, name: string): URL {
  if (!value) {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
  return url;
}

function secureOwnerId(value: string | undefined): string {
  const ownerId = value?.trim();
  const hasControlCharacter = [...(ownerId ?? '')].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
  if (!ownerId || ownerId.length > 128 || hasControlCharacter) {
    throw new Error('CHATGPT_MCP_OWNER_ID is invalid.');
  }
  return ownerId;
}

export function getChatGptMcpReadiness(
  env: NodeJS.ProcessEnv = process.env,
  ingestAdaptersImplemented = false
): ChatGptMcpReadiness {
  const authConfigured = hasCompleteAuth(env);
  const healthReadConfigured = Boolean(getDatabaseUrl(env));
  const privateStorageConfigured =
    hasAll(env, requiredChatGptStorageVariables) &&
    healthReadConfigured;
  const mealWriteConfigured =
    privateStorageConfigured && ingestAdaptersImplemented;
  const ready = authConfigured && (healthReadConfigured || mealWriteConfigured);

  return {
    state: ready ? 'ready' : authConfigured ? 'auth_ready' : 'locked',
    authConfigured,
    healthReadConfigured,
    privateStorageConfigured,
    mealWriteConfigured,
    ingestAdaptersImplemented,
    publicWriteEnabled: false
  };
}

export function loadChatGptMcpRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ChatGptMcpRuntimeConfig {
  if (!hasCompleteAuth(env)) {
    throw new Error('ChatGPT MCP OAuth configuration is incomplete.');
  }

  return {
    resourceUrl: secureUrl(
      env.CHATGPT_MCP_RESOURCE_URL,
      'CHATGPT_MCP_RESOURCE_URL'
    ),
    authorizationServer: secureUrl(
      env.CHATGPT_MCP_AUTHORIZATION_SERVER,
      'CHATGPT_MCP_AUTHORIZATION_SERVER'
    ),
    issuer: env.CHATGPT_MCP_ISSUER as string,
    audience: env.CHATGPT_MCP_AUDIENCE as string,
    jwksUri: secureUrl(env.CHATGPT_MCP_JWKS_URI, 'CHATGPT_MCP_JWKS_URI'),
    ownerId: secureOwnerId(getOwnerId(env)),
    allowedSubject: env.CHATGPT_MCP_ALLOWED_SUBJECT as string
  };
}

function parseAttachmentHosts(value: string): string[] {
  const hosts = value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    hosts.length === 0 ||
    hosts.some(
      (host) =>
        host.includes('/') ||
        host.includes(':') ||
        host.startsWith('.') ||
        host.endsWith('.')
    )
  ) {
    throw new Error('CHATGPT_MCP_ATTACHMENT_HOSTS is invalid.');
  }
  return [...new Set(hosts)];
}

export function loadChatGptMcpStorageConfig(
  env: NodeJS.ProcessEnv = process.env
): ChatGptMcpStorageConfig {
  if (!env.CHATGPT_MCP_ATTACHMENT_HOSTS?.trim()) {
    throw new Error('CHATGPT_MCP_ATTACHMENT_HOSTS is required.');
  }
  return {
    ...loadPrivateMealStorageConfig(env),
    attachmentHosts: parseAttachmentHosts(env.CHATGPT_MCP_ATTACHMENT_HOSTS)
  };
}

export function loadPrivateMealStorageConfig(
  env: NodeJS.ProcessEnv = process.env
): PrivateMealStorageConfig {
  const databaseUrlValue = getDatabaseUrl(env);
  if (!hasAll(env, requiredPrivateStorageVariables) || !databaseUrlValue) {
    throw new Error('Private meal storage configuration is incomplete.');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(databaseUrlValue);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL over TLS.');
  }
  if (databaseUrl.searchParams.get('sslmode') === 'disable') {
    throw new Error('DATABASE_URL must not disable TLS.');
  }

  return {
    databaseUrl: databaseUrl.href,
    privateBlobToken: env.BLOB_READ_WRITE_TOKEN as string,
    ingestHmacSecret: env.CHATGPT_MCP_INGEST_HMAC_SECRET as string
  };
}

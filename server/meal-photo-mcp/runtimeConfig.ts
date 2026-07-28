export const MEAL_WRITE_SCOPE = 'meal.write';

export interface ChatGptMcpRuntimeConfig {
  resourceUrl: URL;
  authorizationServer: URL;
  issuer: string;
  audience: string;
  jwksUri: URL;
  ownerHmacSecret: string;
  allowedSubject: string;
}

export interface ChatGptMcpStorageConfig {
  databaseUrl: string;
  privateBlobToken: string;
  ingestHmacSecret: string;
  attachmentHosts: readonly string[];
}

export interface ChatGptMcpReadiness {
  state: 'locked' | 'auth_ready' | 'ready';
  authConfigured: boolean;
  privateStorageConfigured: boolean;
  ingestAdaptersImplemented: boolean;
  publicWriteEnabled: false;
}

const requiredAuthVariables = [
  'CHATGPT_MCP_RESOURCE_URL',
  'CHATGPT_MCP_AUTHORIZATION_SERVER',
  'CHATGPT_MCP_ISSUER',
  'CHATGPT_MCP_AUDIENCE',
  'CHATGPT_MCP_JWKS_URI',
  'CHATGPT_MCP_OWNER_HMAC_SECRET',
  'CHATGPT_MCP_ALLOWED_SUBJECT'
] as const;

const requiredStorageVariables = [
  'BLOB_READ_WRITE_TOKEN',
  'CHATGPT_MCP_INGEST_HMAC_SECRET',
  'CHATGPT_MCP_ATTACHMENT_HOSTS'
] as const;

const hasAll = (
  env: NodeJS.ProcessEnv,
  names: readonly string[]
): boolean => names.every((name) => Boolean(env[name]?.trim()));

function getDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.DATABASE_URL?.trim() || env.CHATGPT_MCP_DATABASE_URL?.trim();
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

export function getChatGptMcpReadiness(
  env: NodeJS.ProcessEnv = process.env,
  ingestAdaptersImplemented = false
): ChatGptMcpReadiness {
  const authConfigured = hasAll(env, requiredAuthVariables);
  const privateStorageConfigured =
    hasAll(env, requiredStorageVariables) && Boolean(getDatabaseUrl(env));
  const ready =
    authConfigured && privateStorageConfigured && ingestAdaptersImplemented;

  return {
    state: ready ? 'ready' : authConfigured ? 'auth_ready' : 'locked',
    authConfigured,
    privateStorageConfigured,
    ingestAdaptersImplemented,
    publicWriteEnabled: false
  };
}

export function loadChatGptMcpRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ChatGptMcpRuntimeConfig {
  if (!hasAll(env, requiredAuthVariables)) {
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
    ownerHmacSecret: env.CHATGPT_MCP_OWNER_HMAC_SECRET as string,
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
  const databaseUrlValue = getDatabaseUrl(env);
  if (!hasAll(env, requiredStorageVariables) || !databaseUrlValue) {
    throw new Error('ChatGPT MCP private storage configuration is incomplete.');
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
    ingestHmacSecret: env.CHATGPT_MCP_INGEST_HMAC_SECRET as string,
    attachmentHosts: parseAttachmentHosts(
      env.CHATGPT_MCP_ATTACHMENT_HOSTS as string
    )
  };
}

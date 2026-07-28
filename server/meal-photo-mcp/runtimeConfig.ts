export const MEAL_WRITE_SCOPE = 'meal.write';

export interface ChatGptMcpRuntimeConfig {
  resourceUrl: URL;
  authorizationServer: URL;
  issuer: string;
  audience: string;
  jwksUri: URL;
  ownerHmacSecret: string;
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
  'CHATGPT_MCP_OWNER_HMAC_SECRET'
] as const;

const requiredStorageVariables = [
  'CHATGPT_MCP_DATABASE_URL',
  'CHATGPT_MCP_PRIVATE_BLOB_TOKEN',
  'CHATGPT_MCP_INGEST_HMAC_SECRET'
] as const;

const hasAll = (
  env: NodeJS.ProcessEnv,
  names: readonly string[]
): boolean => names.every((name) => Boolean(env[name]?.trim()));

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
  const privateStorageConfigured = hasAll(env, requiredStorageVariables);
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
    ownerHmacSecret: env.CHATGPT_MCP_OWNER_HMAC_SECRET as string
  };
}

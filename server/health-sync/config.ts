import { createHash } from 'node:crypto';

export interface HealthReadConfig {
  databaseUrl: string;
}

export interface HealthSyncConfig extends HealthReadConfig {
  tokenKey: Uint8Array;
  cursorSecret: string;
}

function loadDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const databaseUrl =
    env.DATABASE_URL?.trim() || env.CHATGPT_MCP_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is missing.');

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  if (parsed.searchParams.get('sslmode')?.toLowerCase() === 'disable') {
    throw new Error('DATABASE_URL must not disable TLS.');
  }
  return parsed.href;
}

export function loadHealthReadConfig(
  env: NodeJS.ProcessEnv = process.env
): HealthReadConfig {
  return { databaseUrl: loadDatabaseUrl(env) };
}

function requireSecret(
  env: NodeJS.ProcessEnv,
  name: 'HEALTH_SYNC_TOKEN_SECRET' | 'HEALTH_SYNC_CURSOR_SECRET'
): string {
  const value = env[name]?.trim();
  if (!value || value.length < 32) {
    throw new Error(`${name} is missing or too short.`);
  }
  return value;
}

export function loadHealthSyncConfig(
  env: NodeJS.ProcessEnv = process.env
): HealthSyncConfig {
  const tokenSecret = requireSecret(env, 'HEALTH_SYNC_TOKEN_SECRET');
  return {
    databaseUrl: loadDatabaseUrl(env),
    tokenKey: new Uint8Array(createHash('sha256').update(tokenSecret).digest()),
    cursorSecret: requireSecret(env, 'HEALTH_SYNC_CURSOR_SECRET')
  };
}

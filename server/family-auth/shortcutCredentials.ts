import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { EncryptJWT, jwtDecrypt } from 'jose';

type Row = Record<string, unknown>;

export interface ShortcutCredentialConfig {
  databaseUrl: string;
  tokenKey: Uint8Array;
}

export interface ShortcutCredentialSummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

export interface IssuedShortcutCredential extends ShortcutCredentialSummary {
  token: string;
}

interface ShortcutCredentialClaims {
  credentialId: string;
  ownerId: string;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected database value.');
  return value;
}

function mapSummary(row: Row): ShortcutCredentialSummary {
  return {
    id: asString(row.id),
    label: asString(row.label),
    createdAt: new Date(asString(row.created_at)).toISOString(),
    ...(typeof row.last_used_at === 'string'
      ? { lastUsedAt: new Date(row.last_used_at).toISOString() }
      : {}),
    expiresAt: new Date(asString(row.expires_at)).toISOString()
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function loadShortcutCredentialConfig(
  env: NodeJS.ProcessEnv = process.env
): ShortcutCredentialConfig {
  const databaseUrl =
    env.DATABASE_URL?.trim() || env.CHATGPT_MCP_DATABASE_URL?.trim();
  const secret = env.SHORTCUT_TOKEN_SECRET?.trim();
  if (!databaseUrl || !secret || secret.length < 32) {
    throw new Error('Family Shortcut credential configuration is incomplete.');
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  return {
    databaseUrl: parsed.href,
    tokenKey: new Uint8Array(createHash('sha256').update(secret).digest())
  };
}

export async function sealShortcutCredentialToken(
  claims: ShortcutCredentialClaims,
  config: ShortcutCredentialConfig,
  expiresAt: Date
): Promise<string> {
  return new EncryptJWT({ typ: 'family-shortcut', oid: claims.ownerId })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setJti(claims.credentialId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .encrypt(config.tokenKey);
}

export async function openShortcutCredentialToken(
  token: string,
  config: ShortcutCredentialConfig
): Promise<ShortcutCredentialClaims | undefined> {
  try {
    const { payload } = await jwtDecrypt(token, config.tokenKey, {
      clockTolerance: 5
    });
    if (
      payload.typ !== 'family-shortcut' ||
      typeof payload.jti !== 'string' ||
      typeof payload.oid !== 'string'
    ) {
      return undefined;
    }
    return { credentialId: payload.jti, ownerId: payload.oid };
  } catch {
    return undefined;
  }
}

export async function listShortcutCredentials(
  ownerId: string,
  config: ShortcutCredentialConfig
): Promise<ShortcutCredentialSummary[]> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select id::text, label, created_at::text, last_used_at::text,
              expires_at::text
       from shortcut_credentials
       where owner_id = $1 and revoked_at is null and expires_at > now()
       order by created_at desc`,
      [ownerId]
    )
  ]);
  return (results[1] as Row[]).map(mapSummary);
}

export async function issueShortcutCredential(
  ownerId: string,
  label: string,
  config: ShortcutCredentialConfig
): Promise<IssuedShortcutCredential> {
  const normalizedLabel = label.trim().slice(0, 40);
  if (!normalizedLabel) throw new Error('invalid_label');
  const credentialId = randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const token = await sealShortcutCredentialToken(
    { credentialId, ownerId },
    config,
    expiresAt
  );
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select count(*)::int as count
       from shortcut_credentials
       where owner_id = $1 and revoked_at is null and expires_at > now()`,
      [ownerId]
    ),
    tx.query(
      `insert into shortcut_credentials
         (id, owner_id, token_hash, label, expires_at)
       select $1::uuid, $2, $3, $4, $5::timestamptz
       where (
         select count(*) from shortcut_credentials
         where owner_id = $2 and revoked_at is null and expires_at > now()
       ) < 5
       returning id::text, label, created_at::text, last_used_at::text,
                 expires_at::text`,
      [credentialId, ownerId, tokenHash(token), normalizedLabel, expiresAt.toISOString()]
    )
  ]);
  const rows = results[2] as Row[];
  if (rows.length !== 1) throw new Error('credential_limit');
  return { ...mapSummary(rows[0]), token };
}

export async function revokeShortcutCredential(
  ownerId: string,
  credentialId: string,
  config: ShortcutCredentialConfig
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(credentialId)) return false;
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `update shortcut_credentials
       set revoked_at = now()
       where id = $1::uuid and owner_id = $2 and revoked_at is null
       returning id::text`,
      [credentialId, ownerId]
    )
  ]);
  return (results[1] as Row[]).length === 1;
}

export async function authenticateFamilyShortcutToken(
  token: string,
  config: ShortcutCredentialConfig
): Promise<string | undefined> {
  const claims = await openShortcutCredentialToken(token, config);
  if (!claims) return undefined;
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [claims.ownerId]),
    tx.query(
      `update shortcut_credentials
       set last_used_at = now()
       where id = $1::uuid
         and owner_id = $2
         and token_hash = $3
         and revoked_at is null
         and expires_at > now()
       returning owner_id`,
      [claims.credentialId, claims.ownerId, tokenHash(token)]
    )
  ]);
  const rows = results[1] as Row[];
  return rows.length === 1 ? asString(rows[0].owner_id) : undefined;
}

export function createCredentialLabel(userAgent?: string): string {
  const device = /iPhone/i.test(userAgent ?? '') ? 'iPhone' : '此裝置';
  return `${device} ${randomBytes(3).toString('hex').toUpperCase()}`;
}

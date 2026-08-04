import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { EncryptJWT, jwtDecrypt } from 'jose';
import type { HealthSyncConfig } from './config.js';

type Row = Record<string, unknown>;

export interface HealthSyncCredentialSummary {
  id: string;
  deviceInstallationId: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

export interface IssuedHealthSyncCredential
  extends HealthSyncCredentialSummary {
  token: string;
}

export interface HealthSyncCredentialClaims {
  credentialId: string;
  ownerId: string;
  deviceInstallationId: string;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected database value.');
  return value;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mapSummary(row: Row): HealthSyncCredentialSummary {
  return {
    id: asString(row.id),
    deviceInstallationId: asString(row.device_installation_id),
    label: asString(row.label),
    createdAt: new Date(asString(row.created_at)).toISOString(),
    ...(typeof row.last_used_at === 'string'
      ? { lastUsedAt: new Date(row.last_used_at).toISOString() }
      : {}),
    expiresAt: new Date(asString(row.expires_at)).toISOString()
  };
}

export async function sealHealthSyncCredential(
  claims: HealthSyncCredentialClaims,
  config: HealthSyncConfig,
  expiresAt: Date
): Promise<string> {
  return new EncryptJWT({
    typ: 'health-sync',
    purpose: 'health.sync',
    oid: claims.ownerId,
    did: claims.deviceInstallationId
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setJti(claims.credentialId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .encrypt(config.tokenKey);
}

export async function openHealthSyncCredential(
  token: string,
  config: HealthSyncConfig
): Promise<HealthSyncCredentialClaims | undefined> {
  try {
    const { payload } = await jwtDecrypt(token, config.tokenKey, {
      clockTolerance: 5
    });
    if (
      payload.typ !== 'health-sync' ||
      payload.purpose !== 'health.sync' ||
      typeof payload.jti !== 'string' ||
      typeof payload.oid !== 'string' ||
      typeof payload.did !== 'string'
    ) {
      return undefined;
    }
    return {
      credentialId: payload.jti,
      ownerId: payload.oid,
      deviceInstallationId: payload.did
    };
  } catch {
    return undefined;
  }
}

export async function listHealthSyncCredentials(
  ownerId: string,
  config: HealthSyncConfig
): Promise<HealthSyncCredentialSummary[]> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select id::text, device_installation_id, label, created_at::text,
              last_used_at::text, expires_at::text
       from health_sync_credentials
       where owner_id = $1 and revoked_at is null and expires_at > now()
       order by created_at desc`,
      [ownerId]
    )
  ]);
  return (results[1] as Row[]).map(mapSummary);
}

export async function issueHealthSyncCredential(
  ownerId: string,
  deviceInstallationId: string,
  label: string,
  config: HealthSyncConfig
): Promise<IssuedHealthSyncCredential> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(deviceInstallationId)) {
    throw new Error('invalid_device_id');
  }
  const normalizedLabel = label.trim().slice(0, 40);
  if (!normalizedLabel) throw new Error('invalid_label');

  const credentialId = randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const token = await sealHealthSyncCredential(
    { credentialId, ownerId, deviceInstallationId },
    config,
    expiresAt
  );
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `insert into health_sync_credentials
         (id, owner_id, device_installation_id, token_hash, label, expires_at)
       select $1::uuid, $2, $3, $4, $5, $6::timestamptz
       where (
         select count(*) from health_sync_credentials
         where owner_id = $2 and revoked_at is null and expires_at > now()
       ) < 5
       returning id::text, device_installation_id, label, created_at::text,
                 last_used_at::text, expires_at::text`,
      [
        credentialId,
        ownerId,
        deviceInstallationId,
        tokenHash(token),
        normalizedLabel,
        expiresAt.toISOString()
      ]
    )
  ]);
  const rows = results[1] as Row[];
  if (rows.length !== 1) throw new Error('credential_limit');
  return { ...mapSummary(rows[0]), token };
}

export async function revokeHealthSyncCredential(
  ownerId: string,
  credentialId: string,
  config: HealthSyncConfig
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(credentialId)) return false;
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `update health_sync_credentials
       set revoked_at = now()
       where id = $1::uuid and owner_id = $2 and revoked_at is null
       returning id::text`,
      [credentialId, ownerId]
    )
  ]);
  return (results[1] as Row[]).length === 1;
}

export async function authenticateHealthSyncToken(
  token: string,
  config: HealthSyncConfig
): Promise<HealthSyncCredentialClaims | undefined> {
  const claims = await openHealthSyncCredential(token, config);
  if (!claims) return undefined;
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [claims.ownerId]),
    tx.query(
      `update health_sync_credentials
       set last_used_at = now()
       where id = $1::uuid and owner_id = $2 and device_installation_id = $3
         and token_hash = $4 and revoked_at is null and expires_at > now()
       returning owner_id, device_installation_id`,
      [
        claims.credentialId,
        claims.ownerId,
        claims.deviceInstallationId,
        tokenHash(token)
      ]
    )
  ]);
  return (results[1] as Row[]).length === 1 ? claims : undefined;
}

export function createHealthDeviceLabel(userAgent?: string): string {
  const device = /iPhone/i.test(userAgent ?? '') ? 'iPhone' : 'Apple 裝置';
  return `${device} ${randomBytes(3).toString('hex').toUpperCase()}`;
}

import { createHmac } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { HealthSyncConfig } from './config.js';
import type {
  HealthSyncDayV1,
  HealthSyncInputV1,
  PrivateHealthDayV1
} from './contract.js';
import type {
  ApplyHealthSyncResult,
  HealthSyncRepository
} from './sync.js';

type Row = Record<string, unknown>;

export interface PrivateHealthSyncStatus {
  deviceInstallationId: string;
  lastCollectedAt?: string;
  lastSyncAt?: string;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected database value.');
  return value;
}

function asNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Unexpected database number.');
  return number;
}

function parseSnapshot(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error('Health sync response snapshot is invalid.');
}

export function createHealthSyncCursor(
  config: Pick<HealthSyncConfig, 'cursorSecret'>,
  ownerId: string,
  deviceInstallationId: string,
  syncId: string
): string {
  const digest = createHmac('sha256', config.cursorSecret)
    .update(['health-sync-cursor-v1', ownerId, deviceInstallationId, syncId].join('\0'))
    .digest('base64url');
  return `hsc1_${digest}`;
}

function metricValue(day: HealthSyncDayV1, key: keyof HealthSyncDayV1['metrics']) {
  return day.metrics[key] ?? null;
}

export class NeonHealthSyncRepository implements HealthSyncRepository {
  constructor(
    private readonly sql: NeonQueryFunction<false, false>,
    private readonly config: Pick<HealthSyncConfig, 'cursorSecret'>
  ) {}

  async applyOnce(input: {
    ownerId: string;
    requestDigest: string;
    sync: HealthSyncInputV1;
    serverTime: string;
  }): Promise<ApplyHealthSyncResult> {
    const { ownerId, requestDigest, sync, serverTime } = input;
    const cursor = createHealthSyncCursor(
      this.config,
      ownerId,
      sync.device_installation_id,
      sync.sync_id
    );
    const results = await this.sql.transaction((tx) => [
      tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
      tx.query(
        `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`${ownerId}\0${sync.sync_id}`]
      ),
      tx.query(
        `insert into health_sync_requests (
           owner_id, sync_id, device_installation_id, request_digest,
           status, accepted_days
         ) values ($1, $2::uuid, $3, $4, 'processing', $5)
         on conflict (owner_id, sync_id) do nothing
         returning sync_id::text`,
        [
          ownerId,
          sync.sync_id,
          sync.device_installation_id,
          requestDigest,
          sync.days.length
        ]
      ),
      ...sync.days.map((day) =>
        tx.query(
          `with changed as (
             insert into health_daily_metrics (
               owner_id, local_date, timezone, steps, active_energy_kcal,
               exercise_minutes, sleep_hours, weight_kg, body_fat_percent,
               source_updated_at
             )
             select $1, $2::date, $3, $4::integer, $5::double precision,
                    $6::double precision, $7::double precision,
                    $8::double precision, $9::double precision,
                    $10::timestamptz
             where exists (
               select 1 from health_sync_requests
               where owner_id = $1 and sync_id = $11::uuid
                 and request_digest = $12 and status = 'processing'
             )
             on conflict (owner_id, local_date) do update set
               timezone = excluded.timezone,
               steps = coalesce(excluded.steps, health_daily_metrics.steps),
               active_energy_kcal = coalesce(
                 excluded.active_energy_kcal,
                 health_daily_metrics.active_energy_kcal
               ),
               exercise_minutes = coalesce(
                 excluded.exercise_minutes,
                 health_daily_metrics.exercise_minutes
               ),
               sleep_hours = coalesce(
                 excluded.sleep_hours,
                 health_daily_metrics.sleep_hours
               ),
               weight_kg = coalesce(excluded.weight_kg, health_daily_metrics.weight_kg),
               body_fat_percent = coalesce(
                 excluded.body_fat_percent,
                 health_daily_metrics.body_fat_percent
               ),
               source_updated_at = excluded.source_updated_at,
               updated_at = now()
             where excluded.source_updated_at >= health_daily_metrics.source_updated_at
               and (
                 excluded.timezone is distinct from health_daily_metrics.timezone or
                 excluded.source_updated_at is distinct from health_daily_metrics.source_updated_at or
                 (excluded.steps is not null and excluded.steps is distinct from health_daily_metrics.steps) or
                 (excluded.active_energy_kcal is not null and excluded.active_energy_kcal is distinct from health_daily_metrics.active_energy_kcal) or
                 (excluded.exercise_minutes is not null and excluded.exercise_minutes is distinct from health_daily_metrics.exercise_minutes) or
                 (excluded.sleep_hours is not null and excluded.sleep_hours is distinct from health_daily_metrics.sleep_hours) or
                 (excluded.weight_kg is not null and excluded.weight_kg is distinct from health_daily_metrics.weight_kg) or
                 (excluded.body_fat_percent is not null and excluded.body_fat_percent is distinct from health_daily_metrics.body_fat_percent)
               )
             returning 1
           )
           update health_sync_requests
           set changed_days = changed_days + (select count(*) from changed),
               updated_at = now()
           where owner_id = $1 and sync_id = $11::uuid
             and request_digest = $12 and status = 'processing'`,
          [
            ownerId,
            day.local_date,
            day.timezone,
            metricValue(day, 'steps'),
            metricValue(day, 'active_energy_kcal'),
            metricValue(day, 'exercise_minutes'),
            metricValue(day, 'sleep_hours'),
            metricValue(day, 'weight_kg'),
            metricValue(day, 'body_fat_percent'),
            day.source_updated_at,
            sync.sync_id,
            requestDigest
          ]
        )
      ),
      tx.query(
        `insert into health_sync_devices (
           owner_id, device_installation_id, last_cursor, last_collected_at,
           last_sync_id, last_sync_at, updated_at
         )
         select $1, $2, $3, $4::timestamptz, $5::uuid,
                $6::timestamptz, now()
         where exists (
           select 1 from health_sync_requests
           where owner_id = $1 and sync_id = $5::uuid
             and request_digest = $7 and status = 'processing'
         )
         on conflict (owner_id, device_installation_id) do update set
           last_cursor = excluded.last_cursor,
           last_collected_at = excluded.last_collected_at,
           last_sync_id = excluded.last_sync_id,
           last_sync_at = excluded.last_sync_at,
           updated_at = now()`,
        [
          ownerId,
          sync.device_installation_id,
          cursor,
          sync.collected_at,
          sync.sync_id,
          serverTime,
          requestDigest
        ]
      ),
      tx.query(
        `update health_sync_requests
         set status = 'recorded',
             response_snapshot = jsonb_build_object(
               'accepted_days', accepted_days,
               'changed_days', changed_days,
               'cursor', $4,
               'server_time', $5::timestamptz
             ),
             updated_at = now()
         where owner_id = $1 and sync_id = $2::uuid
           and request_digest = $3 and status = 'processing'`,
        [ownerId, sync.sync_id, requestDigest, cursor, serverTime]
      ),
      tx.query(
        `select request_digest, status, response_snapshot
         from health_sync_requests
         where owner_id = $1 and sync_id = $2::uuid`,
        [ownerId, sync.sync_id]
      )
    ]);

    const inserted = (results[2] as Row[]).length === 1;
    const rows = results[results.length - 1] as Row[];
    const row = rows[0];
    if (!row) throw new Error('Health sync request did not resolve.');
    if (asString(row.request_digest) !== requestDigest) {
      return {
        state: 'digest_conflict',
        acceptedDays: 0,
        changedDays: 0,
        cursor: '',
        serverTime
      };
    }
    if (asString(row.status) !== 'recorded') {
      throw new Error('Health sync request did not finish recording.');
    }
    const snapshot = parseSnapshot(row.response_snapshot);
    return {
      state: inserted ? 'applied' : 'already_applied',
      acceptedDays: asNumber(snapshot.accepted_days),
      changedDays: asNumber(snapshot.changed_days),
      cursor: asString(snapshot.cursor),
      serverTime: new Date(asString(snapshot.server_time)).toISOString()
    };
  }
}

export function createProductionHealthSyncRepository(
  config: HealthSyncConfig
): HealthSyncRepository {
  return new NeonHealthSyncRepository(neon(config.databaseUrl), config);
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  return asNumber(value);
}

export function mapPrivateHealthDay(row: Row): PrivateHealthDayV1 {
  return {
    local_date: asString(row.local_date).slice(0, 10),
    timezone: asString(row.timezone),
    source_updated_at: new Date(asString(row.source_updated_at)).toISOString(),
    ...(optionalNumber(row.steps) !== undefined
      ? { steps: optionalNumber(row.steps) }
      : {}),
    ...(optionalNumber(row.active_energy_kcal) !== undefined
      ? { active_energy_kcal: optionalNumber(row.active_energy_kcal) }
      : {}),
    ...(optionalNumber(row.exercise_minutes) !== undefined
      ? { exercise_minutes: optionalNumber(row.exercise_minutes) }
      : {}),
    ...(optionalNumber(row.sleep_hours) !== undefined
      ? { sleep_hours: optionalNumber(row.sleep_hours) }
      : {}),
    ...(optionalNumber(row.weight_kg) !== undefined
      ? { weight_kg: optionalNumber(row.weight_kg) }
      : {}),
    ...(optionalNumber(row.body_fat_percent) !== undefined
      ? { body_fat_percent: optionalNumber(row.body_fat_percent) }
      : {})
  };
}

export async function listPrivateHealthDays(
  ownerId: string,
  from: string,
  to: string,
  config: HealthSyncConfig
): Promise<PrivateHealthDayV1[]> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select local_date::text, timezone, steps, active_energy_kcal,
              exercise_minutes, sleep_hours, weight_kg, body_fat_percent,
              source_updated_at::text
       from health_daily_metrics
       where owner_id = $1 and local_date between $2::date and $3::date
       order by local_date asc`,
      [ownerId, from, to]
    )
  ]);
  return (results[1] as Row[]).map(mapPrivateHealthDay);
}

export async function listPrivateHealthSyncStatus(
  ownerId: string,
  config: HealthSyncConfig
): Promise<PrivateHealthSyncStatus[]> {
  const sql = neon(config.databaseUrl);
  const results = await sql.transaction((tx) => [
    tx.query(`select set_config('app.owner_id', $1, true)`, [ownerId]),
    tx.query(
      `select device_installation_id, last_collected_at::text, last_sync_at::text
       from health_sync_devices
       where owner_id = $1
       order by last_sync_at desc nulls last`,
      [ownerId]
    )
  ]);
  return (results[1] as Row[]).map((row) => ({
    deviceInstallationId: asString(row.device_installation_id),
    ...(typeof row.last_collected_at === 'string'
      ? { lastCollectedAt: new Date(row.last_collected_at).toISOString() }
      : {}),
    ...(typeof row.last_sync_at === 'string'
      ? { lastSyncAt: new Date(row.last_sync_at).toISOString() }
      : {})
  }));
}

import {
  HEALTH_SYNC_SCHEMA_VERSION,
  digestHealthSyncInput,
  type HealthSyncInputV1,
  type HealthSyncResponseV1
} from './contract.js';

export interface ApplyHealthSyncResult {
  state: 'applied' | 'already_applied' | 'digest_conflict';
  acceptedDays: number;
  changedDays: number;
  cursor: string;
  serverTime: string;
}

export interface HealthSyncRepository {
  applyOnce(input: {
    ownerId: string;
    requestDigest: string;
    sync: HealthSyncInputV1;
    serverTime: string;
  }): Promise<ApplyHealthSyncResult>;
}

export class HealthSyncConflictError extends Error {
  constructor() {
    super('A sync_id cannot be reused with different content.');
    this.name = 'HealthSyncConflictError';
  }
}

export async function applyHealthSync(
  ownerId: string,
  sync: HealthSyncInputV1,
  repository: HealthSyncRepository,
  now: () => Date = () => new Date()
): Promise<HealthSyncResponseV1> {
  const serverTime = now().toISOString();
  const result = await repository.applyOnce({
    ownerId,
    requestDigest: digestHealthSyncInput(sync),
    sync,
    serverTime
  });

  if (result.state === 'digest_conflict') throw new HealthSyncConflictError();

  return {
    schema_version: HEALTH_SYNC_SCHEMA_VERSION,
    sync_id: sync.sync_id,
    status: result.state,
    accepted_days: result.acceptedDays,
    changed_days: result.changedDays,
    cursor: result.cursor,
    server_time: result.serverTime
  };
}

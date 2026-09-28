import { useCallback, useEffect, useState } from 'react';
import {
  parsePrivateHealthResponse,
  parsePrivateHealthSyncStatus,
  type PrivateHealthSyncStatus
} from '../lib/privateHealth';
import type { DailyHealthRecord } from '../models/health';

export type PrivateHealthStatus = 'idle' | 'loading' | 'ready' | 'error';

async function readJson(response: Response, unavailableMessage: string): Promise<unknown> {
  if (!response.ok) throw new Error(unavailableMessage);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('私人健康服務回傳格式不正確。');
  }
  return response.json() as Promise<unknown>;
}

export function usePrivateHealth(enabled: boolean) {
  const [records, setRecords] = useState<DailyHealthRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<PrivateHealthSyncStatus>();
  const [status, setStatus] = useState<PrivateHealthStatus>('idle');
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setStatus('loading');
    setError(undefined);
    try {
      const [healthResponse, statusResponse] = await Promise.all([
        fetch('/api/private/health', {
          cache: 'no-store',
          credentials: 'same-origin'
        }),
        fetch('/api/private/health/sync-status', {
          cache: 'no-store',
          credentials: 'same-origin'
        })
      ]);
      const [healthBody, statusBody] = await Promise.all([
        readJson(healthResponse, '暫時未能載入私人健康資料。'),
        readJson(statusResponse, '暫時未能載入同步狀態。')
      ]);
      setRecords(parsePrivateHealthResponse(healthBody));
      setSyncStatus(parsePrivateHealthSyncStatus(statusBody));
      setStatus('ready');
    } catch (reason) {
      setRecords([]);
      setSyncStatus(undefined);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '私人健康服務暫時不可用。');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setSyncStatus(undefined);
      setStatus('idle');
      setError(undefined);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return { records, syncStatus, status, error, refresh };
}

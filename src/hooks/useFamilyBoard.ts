import { useCallback, useEffect, useState } from 'react';
import {
  parseFamilyBoardResponse,
  type FamilyBoardResponse
} from '../contracts/familyBoard';

export type FamilyBoardStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'setup-required'
  | 'error';

export function useFamilyBoard(enabled: boolean) {
  const [data, setData] = useState<FamilyBoardResponse>();
  const [status, setStatus] = useState<FamilyBoardStatus>('idle');
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setStatus('loading');
    setError(undefined);

    try {
      const response = await fetch('/api/private/family-board', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (response.status === 404 || response.status === 501) {
        setData(undefined);
        setStatus('setup-required');
        return;
      }
      if (!response.ok) throw new Error('家庭看板暫時未能更新。');
      if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
        throw new Error('家庭看板服務回傳格式不正確。');
      }
      setData(parseFamilyBoardResponse(await response.json()));
      setStatus('ready');
    } catch (reason) {
      setData(undefined);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '家庭看板暫時不可用。');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setStatus('idle');
      setError(undefined);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || status !== 'ready' || !data) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, data.refreshAfterSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [data, enabled, refresh, status]);

  return { data, status, error, refresh };
}

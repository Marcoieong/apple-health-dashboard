import { useCallback, useEffect, useState } from 'react';
import type {
  ImportedHealthAdvice,
  ImportedHealthAdviceResponse
} from '../models/importedHealthAdvice';


export type ImportedHealthAdviceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

function isAdvice(value: unknown): value is ImportedHealthAdvice {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    (item.source === 'chatgpt_health_manual' ||
      item.source === 'chatgpt_health_shortcut') &&
    typeof item.content === 'string' &&
    (item.capturedAt === undefined || typeof item.capturedAt === 'string') &&
    typeof item.createdAt === 'string'
  );
}

function parseResponse(value: unknown): ImportedHealthAdvice[] {
  const response = value as Partial<ImportedHealthAdviceResponse> | null;
  if (!response || !Array.isArray(response.advice)) {
    throw new Error('私人建議服務回傳格式不正確。');
  }
  return response.advice.filter(isAdvice);
}

async function jsonResponse(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('私人建議服務回傳格式不正確。');
  }
  return response.json();
}

export function useImportedHealthAdvice(enabled = true) {
  const [advice, setAdvice] = useState<ImportedHealthAdvice[]>([]);
  const [status, setStatus] = useState<ImportedHealthAdviceStatus>('idle');
  const [error, setError] = useState<string>();

  const load = useCallback(async (background = false) => {
    if (!enabled) return;
    if (!background) setStatus('loading');
    setError(undefined);
    try {
      const response = await fetch('/api/private/chatgpt-health-advice', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('暫時未能載入私人建議。');
      setAdvice(parseResponse(await jsonResponse(response)));
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '私人建議暫時不可用。');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setAdvice([]);
      setStatus('idle');
      setError(undefined);
      return;
    }
    void load();
    const refresh = () => void load(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(
      refresh,
      30 * 60_000
    );
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [enabled, load]);

  const save = useCallback(async (content: string) => {
    setStatus('saving');
    setError(undefined);
    try {
      const response = await fetch('/api/private/chatgpt-health-advice', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error('未能儲存這項建議。');
      const next = parseResponse(await jsonResponse(response));
      setAdvice((current) => [...next, ...current]);
      setStatus('ready');
      return true;
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '未能儲存這項建議。');
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(undefined);
    try {
      const response = await fetch('/api/private/chatgpt-health-advice', {
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error('未能刪除這項建議。');
      setAdvice((current) => current.filter((item) => item.id !== id));
      setStatus('ready');
      return true;
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '未能刪除這項建議。');
      return false;
    }
  }, []);

  return { advice, status, error, load, save, remove };
}

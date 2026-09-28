import { useCallback, useEffect, useState } from 'react';

export type FamilySessionStatus =
  | 'checking'
  | 'signed-out'
  | 'authenticated'
  | 'error';

export interface FamilyMember {
  email: string;
  name?: string;
  isAdmin: boolean;
}

export type FamilyLoginDestination =
  | 'today'
  | 'weekly'
  | 'monthly'
  | 'food-journal'
  | 'family-board';

function destinationUrl(destination: FamilyLoginDestination): string {
  const params = new URLSearchParams({ section: destination });
  const invitation = new URLSearchParams(window.location.search).get('invite');
  if (destination === 'family-board' && invitation) params.set('invite', invitation);
  return `/?${params.toString()}`;
}

function parseMember(value: unknown): FamilyMember | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const member = value as Record<string, unknown>;
  if (typeof member.email !== 'string' || typeof member.isAdmin !== 'boolean') {
    return undefined;
  }

  return {
    email: member.email,
    ...(typeof member.name === 'string' ? { name: member.name } : {}),
    isAdmin: member.isAdmin
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('此預覽未連接家庭登入服務；請使用已部署的安全網址。');
  }
  return response.json() as Promise<unknown>;
}

export function useFamilySession() {
  const [member, setMember] = useState<FamilyMember>();
  const [status, setStatus] = useState<FamilySessionStatus>('checking');
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setStatus('checking');
    setError(undefined);

    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('登入服務暫時不可用。');

      const body = await readJsonResponse(response);
      const authenticated =
        body &&
        typeof body === 'object' &&
        (body as { authenticated?: unknown }).authenticated === true;
      const nextMember = authenticated
        ? parseMember((body as { member?: unknown }).member)
        : undefined;

      if (!nextMember) {
        setMember(undefined);
        setStatus('signed-out');
        return;
      }

      setMember(nextMember);
      setStatus('authenticated');
    } catch (reason) {
      setMember(undefined);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '登入服務暫時不可用。');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback((destination: FamilyLoginDestination = 'food-journal') => {
    const returnTo = encodeURIComponent(destinationUrl(destination));
    window.location.assign(`/api/auth/login?returnTo=${returnTo}`);
  }, []);

  const logout = useCallback((destination: FamilyLoginDestination = 'food-journal') => {
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin'
    }).finally(() => {
      window.location.assign(destinationUrl(destination));
    });
  }, []);

  return { member, status, error, login, logout, refresh };
}

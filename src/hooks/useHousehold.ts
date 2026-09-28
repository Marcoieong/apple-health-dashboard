import { useCallback, useEffect, useState } from 'react';
import {
  parseHouseholdSnapshot,
  type HouseholdSharingScope,
  type HouseholdSnapshot
} from '../contracts/household';

const INVITATION_KEY = 'health-dashboard:family-invitation';

export type HouseholdStatus = 'idle' | 'loading' | 'ready' | 'setup-required' | 'error';

interface InvitationResult {
  invitationId: string;
  token: string;
  expiresAt: string;
}

function invitationFromUrl(): string | undefined {
  const token = new URLSearchParams(window.location.search).get('invite')?.trim();
  if (token) {
    sessionStorage.setItem(INVITATION_KEY, token);
    return token;
  }
  return sessionStorage.getItem(INVITATION_KEY) ?? undefined;
}

async function jsonResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => undefined);
  if (response.ok) return body;
  const code = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  if (code === 'invitation_invalid_or_email_mismatch') {
    throw new Error('邀請已失效，或邀請電郵與目前登入帳戶不一致。');
  }
  if (code === 'already_in_household') throw new Error('這個帳戶已加入另一個家庭。');
  if (code === 'forbidden') throw new Error('你沒有權限執行這項家庭設定。');
  throw new Error('家庭設定暫時未能儲存，請稍後再試。');
}

export function useHousehold(enabled: boolean) {
  const [data, setData] = useState<HouseholdSnapshot>();
  const [status, setStatus] = useState<HouseholdStatus>('idle');
  const [error, setError] = useState<string>();
  const [pendingInvitation, setPendingInvitation] = useState(invitationFromUrl);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setStatus('loading');
    setError(undefined);
    try {
      const response = await fetch('/api/private/household', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (response.status === 404) {
        setData(undefined);
        setStatus('setup-required');
        return;
      }
      const body = await jsonResponse(response);
      setData(parseHouseholdSnapshot(body));
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '家庭設定暫時不可用。');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const mutate = useCallback(async (
    path: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body: Record<string, unknown>
  ) => {
    setError(undefined);
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return jsonResponse(response);
  }, []);

  const createHousehold = useCallback(async (name: string) => {
    setStatus('loading');
    try {
      const body = await mutate('/api/private/household', 'POST', { name });
      setData(parseHouseholdSnapshot(body));
      setStatus('ready');
    } catch (reason) {
      setStatus('setup-required');
      setError(reason instanceof Error ? reason.message : '未能建立家庭。');
      throw reason;
    }
  }, [mutate]);

  const createInvitation = useCallback(async (email: string): Promise<InvitationResult> => {
    const body = await mutate('/api/private/household/invitations', 'POST', { email });
    await refresh();
    return body as InvitationResult;
  }, [mutate, refresh]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    await mutate('/api/private/household/invitations', 'DELETE', { invitationId });
    await refresh();
  }, [mutate, refresh]);

  const acceptInvitation = useCallback(async () => {
    if (!pendingInvitation) return;
    setStatus('loading');
    try {
      const body = await mutate('/api/private/household/invitations/accept', 'POST', {
        token: pendingInvitation
      });
      sessionStorage.removeItem(INVITATION_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState(null, '', url);
      setPendingInvitation(undefined);
      setData(parseHouseholdSnapshot(body));
      setStatus('ready');
    } catch (reason) {
      setStatus('setup-required');
      setError(reason instanceof Error ? reason.message : '未能接受邀請。');
      throw reason;
    }
  }, [mutate, pendingInvitation]);

  const updateSharing = useCallback(async (
    viewerMemberId: string,
    scopes: HouseholdSharingScope[]
  ) => {
    await mutate('/api/private/household/sharing', 'PUT', { viewerMemberId, scopes });
    await refresh();
  }, [mutate, refresh]);

  return {
    data,
    status,
    error,
    pendingInvitation: Boolean(pendingInvitation),
    refresh,
    createHousehold,
    createInvitation,
    revokeInvitation,
    acceptInvitation,
    updateSharing
  };
}

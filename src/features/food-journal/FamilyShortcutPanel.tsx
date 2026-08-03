import { Check, Copy, KeyRound, LoaderCircle, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CredentialSummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

interface IssuedCredential extends CredentialSummary {
  token: string;
}

function isCredential(value: unknown): value is CredentialSummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    typeof item.createdAt === 'string' &&
    (item.lastUsedAt === undefined || typeof item.lastUsedAt === 'string') &&
    typeof item.expiresAt === 'string'
  );
}

function isIssuedCredential(value: unknown): value is IssuedCredential {
  return isCredential(value) && typeof (value as { token?: unknown }).token === 'string';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-Hant-MO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

export function FamilyShortcutPanel() {
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [issued, setIssued] = useState<IssuedCredential>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'working' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    const response = await fetch('/api/private/shortcut-credentials', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error('暫時未能載入 iPhone 上傳設定。');
    const body: unknown = await response.json();
    const items =
      body && typeof body === 'object'
        ? (body as { credentials?: unknown }).credentials
        : undefined;
    if (!Array.isArray(items) || !items.every(isCredential)) {
      throw new Error('iPhone 上傳設定格式不正確。');
    }
    setCredentials(items);
    setStatus('ready');
  }, []);

  useEffect(() => {
    void load().catch((reason) => {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '暫時未能載入設定。');
    });
  }, [load]);

  async function createCredential() {
    setStatus('working');
    setError(undefined);
    try {
      const response = await fetch('/api/private/shortcut-credentials', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '我的 iPhone' })
      });
      const body: unknown = await response.json();
      const credential =
        body && typeof body === 'object'
          ? (body as { credential?: unknown }).credential
          : undefined;
      if (
        !response.ok ||
        !isIssuedCredential(credential)
      ) {
        throw new Error(
          response.status === 400
            ? '最多可保留 5 個上傳金鑰，請先撤銷舊金鑰。'
            : '未能建立上傳金鑰。'
        );
      }
      const next = credential;
      setIssued(next);
      setCredentials((current) => [next, ...current]);
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '未能建立上傳金鑰。');
    }
  }

  async function revoke(id: string) {
    setStatus('working');
    setError(undefined);
    try {
      const response = await fetch('/api/private/shortcut-credentials', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error('未能撤銷上傳金鑰。');
      setCredentials((current) => current.filter((item) => item.id !== id));
      if (issued?.id === id) setIssued(undefined);
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '未能撤銷上傳金鑰。');
    }
  }

  async function copyToken() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <details className="family-shortcut-panel">
      <summary>
        <span><Smartphone size={19} aria-hidden="true" />iPhone 上傳設定</span>
        <small>{credentials.length} 個有效金鑰</small>
      </summary>
      <div className="family-shortcut-content">
        <p>每位家庭成員使用自己的金鑰上傳；金鑰可隨時撤銷，不會取得其他人的資料。</p>

        {issued ? (
          <div className="issued-credential" role="status">
            <strong>請立即複製：這個金鑰只顯示一次</strong>
            <code>{issued.token}</code>
            <button type="button" className="secondary-button" onClick={() => void copyToken()}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? '已複製' : '複製上傳金鑰'}
            </button>
          </div>
        ) : null}

        <div className="shortcut-credential-actions">
          <button
            type="button"
            className="primary-button"
            disabled={status === 'working' || credentials.length >= 5}
            onClick={() => void createCredential()}
          >
            {status === 'working' ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
            建立我的 iPhone 金鑰
          </button>
        </div>

        {error ? <p className="journal-access-error" role="alert">{error}</p> : null}
        {status === 'loading' ? <p className="muted-copy">正在載入設定…</p> : null}

        {credentials.length ? (
          <ul className="shortcut-credential-list">
            {credentials.map((credential) => (
              <li key={credential.id}>
                <div>
                  <strong>{credential.label}</strong>
                  <span>
                    建立於 {formatDate(credential.createdAt)}
                    {credential.lastUsedAt ? ` · 最近使用 ${formatDate(credential.lastUsedAt)}` : ' · 尚未使用'}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`撤銷 ${credential.label}`}
                  title="撤銷金鑰"
                  disabled={status === 'working'}
                  onClick={() => void revoke(credential.id)}
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        ) : status === 'ready' ? <p className="muted-copy">尚未建立 iPhone 上傳金鑰。</p> : null}
      </div>
    </details>
  );
}

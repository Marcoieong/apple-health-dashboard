import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Smartphone } from 'lucide-react';
import type { PrivateHealthStatus } from '../hooks/usePrivateHealth';
import type { PrivateHealthSyncStatus as SyncStatus } from '../lib/privateHealth';

interface HealthSyncStatusProps {
  status: PrivateHealthStatus;
  syncStatus?: SyncStatus;
  error?: string;
  onRetry: () => void;
}

function formatSyncTime(value: string): string {
  return new Intl.DateTimeFormat('zh-Hant-MO', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function HealthSyncStatus({
  status,
  syncStatus,
  error,
  onRetry
}: HealthSyncStatusProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <aside className="health-sync-status" aria-live="polite">
        <LoaderCircle className="sync-spinner" size={21} aria-hidden="true" />
        <div>
          <strong>正在載入私人健康資料</strong>
          <span>資料不會與 Demo Data 混合。</span>
        </div>
      </aside>
    );
  }

  if (status === 'error') {
    return (
      <aside className="health-sync-status sync-error" role="alert">
        <CircleAlert size={21} aria-hidden="true" />
        <div>
          <strong>私人健康資料暫時未能載入</strong>
          <span>{error ?? '請稍後再試。'}</span>
        </div>
        <button className="sync-retry-button" type="button" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          重試
        </button>
      </aside>
    );
  }

  const hasDevice = Boolean(syncStatus?.deviceCount);
  const latestSyncAt = syncStatus?.latestSyncAt;
  return (
    <aside className="health-sync-status" aria-label="Apple Health 同步狀態">
      {hasDevice ? <CircleCheck size={21} aria-hidden="true" /> : <Smartphone size={21} aria-hidden="true" />}
      <div>
        <strong>{hasDevice ? '私人 Apple Health 資料' : '等待連接 iPhone'}</strong>
        <span>
          {hasDevice
            ? `${syncStatus?.deviceCount} 部裝置${latestSyncAt ? ` · 最近同步 ${formatSyncTime(latestSyncAt)}` : ''}`
            : '尚未收到 HealthKit 同步；Dashboard 會保持空白，不會以 Demo 代替。'}
        </span>
      </div>
      <span className="private-data-label">只限本人</span>
    </aside>
  );
}

import { LoaderCircle, LockKeyhole, LogIn, RefreshCw } from 'lucide-react';
import type { FamilySessionStatus } from '../hooks/useFamilySession';

interface PrivateDataGateProps {
  status: FamilySessionStatus;
  error?: string;
  onLogin: () => void;
  onRetry: () => Promise<void>;
}

export function PrivateDataGate({
  status,
  error,
  onLogin,
  onRetry
}: PrivateDataGateProps) {
  const checking = status === 'checking';
  const failed = status === 'error';

  return (
    <section className="empty-state private-data-gate" aria-live="polite">
      {checking ? (
        <LoaderCircle className="empty-icon sync-spinner" size={34} aria-hidden="true" />
      ) : (
        <LockKeyhole className="empty-icon" size={34} aria-hidden="true" />
      )}
      <p className="eyebrow">Private health data</p>
      <h2>
        {checking
          ? '正在確認登入狀態'
          : failed
            ? '未能確認登入狀態'
            : '私人健康資料已鎖定'}
      </h2>
      <p>
        {failed
          ? error ?? '登入服務暫時不可用，請稍後再試。'
          : checking
            ? '確認完成後，只會讀取這個家庭帳戶已同步的 Apple Health 每日匯總。'
            : '登入後才會從受保護 API 讀取你的 Apple Health 每日匯總；未登入不顯示示範或私人資料。'}
      </p>
      {!checking ? (
        <button
          className="primary-button"
          type="button"
          onClick={failed ? () => void onRetry() : onLogin}
        >
          {failed ? <RefreshCw size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
          {failed ? '重新檢查' : '登入家庭帳戶'}
        </button>
      ) : null}
    </section>
  );
}

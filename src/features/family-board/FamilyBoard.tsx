import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { createDemoFamilyBoard } from '../../data/demoFamilyBoard';
import type { FamilyMember, FamilySessionStatus } from '../../hooks/useFamilySession';
import type { FamilyBoardStatus } from '../../hooks/useFamilyBoard';
import type { HouseholdStatus } from '../../hooks/useHousehold';
import type { HouseholdSharingScope, HouseholdSnapshot } from '../../contracts/household';
import type {
  FamilyBoardMember,
  FamilyBoardResponse
} from '../../contracts/familyBoard';
import { HouseholdSettings } from './HouseholdSettings';

interface FamilyBoardProps {
  sessionStatus: FamilySessionStatus;
  status: FamilyBoardStatus;
  data?: FamilyBoardResponse;
  error?: string;
  member?: FamilyMember;
  householdStatus: HouseholdStatus;
  householdData?: HouseholdSnapshot;
  householdError?: string;
  pendingInvitation: boolean;
  onLogin: () => void;
  onRefresh: () => void;
  onCreateHousehold: (name: string) => Promise<void>;
  onCreateInvitation: (email: string) => Promise<{ invitationId: string; token: string; expiresAt: string }>;
  onRevokeInvitation: (invitationId: string) => Promise<void>;
  onAcceptInvitation: () => Promise<void>;
  onUpdateSharing: (viewerMemberId: string, scopes: HouseholdSharingScope[]) => Promise<void>;
}

const statusLabels = {
  met: '達標', close: '接近', attention: '留意', unavailable: '未有資料'
} as const;

function Direction({ value }: { value: FamilyBoardMember['weeklyDirection'] }) {
  if (value === 'up') return <span className="board-direction up"><ArrowUpRight size={17} /> 本週改善</span>;
  if (value === 'down') return <span className="board-direction down"><ArrowDownRight size={17} /> 本週回落</span>;
  if (value === 'flat') return <span className="board-direction"><ArrowRight size={17} /> 本週持平</span>;
  return <span className="board-direction"><Clock3 size={16} /> 等待趨勢</span>;
}

function MemberCard({ member }: { member: FamilyBoardMember }) {
  return (
    <article className="family-member-card">
      <header className="member-card-header">
        <span className="member-avatar" aria-hidden="true">{member.avatarLabel ?? member.displayName.slice(0, 1)}</span>
        <div>
          <h3>{member.displayName}</h3>
          <span>{member.isCurrentUser ? '我的已分享摘要' : `更新至 ${member.asOfDate}`}</span>
        </div>
        <div className="member-score" aria-label={member.score === null ? '尚未有健康評分' : `健康評分 ${member.score} 分`}>
          <strong>{member.score ?? '—'}</strong><small>/100</small>
        </div>
      </header>

      <div className="board-metric-list">
        {Object.entries(member.metrics).map(([key, metric]) => (
          <div className="board-metric" key={key}>
            <span className={`metric-state ${metric.status}`} aria-hidden="true">
              {metric.status === 'met' ? <Check size={15} /> : null}
            </span>
            <div><strong>{key === 'steps' ? '活動' : key === 'exercise' ? '運動' : '睡眠'}</strong><span>{metric.label}</span></div>
            <small className={metric.status}>{statusLabels[metric.status]}</small>
          </div>
        ))}
      </div>

      <footer className="member-card-footer">
        <Direction value={member.weeklyDirection} />
        <p><strong>今日建議</strong>{member.advice}</p>
      </footer>
    </article>
  );
}

export function FamilyBoard({
  sessionStatus,
  status,
  data,
  error,
  member,
  householdStatus,
  householdData,
  householdError,
  pendingInvitation,
  onLogin,
  onRefresh,
  onCreateHousehold,
  onCreateInvitation,
  onRevokeInvitation,
  onAcceptInvitation,
  onUpdateSharing
}: FamilyBoardProps) {
  const isDemo = sessionStatus !== 'authenticated';
  const board = isDemo ? createDemoFamilyBoard() : data;

  return (
    <section className="family-board-page" aria-labelledby="family-board-title">
      <div className="family-board-heading">
        <div>
          <p className="eyebrow">客廳 iPad · 家庭共用</p>
          <h2 id="family-board-title">今日家庭節奏</h2>
          <p>只顯示每位成員主動分享的達標狀態及簡短建議。</p>
        </div>
        {sessionStatus === 'authenticated' ? (
          <button className="board-refresh-button" type="button" onClick={onRefresh} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'sync-spinner' : ''} size={18} />
            {status === 'loading' ? '更新中' : '立即更新'}
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onLogin}>登入家庭看板</button>
        )}
      </div>

      <div className={`family-board-trust ${isDemo ? 'demo' : ''}`}>
        {isDemo ? <UsersRound size={21} /> : <ShieldCheck size={21} />}
        <div>
          <strong>{isDemo ? '目前顯示虛構示範家庭' : '經成員授權的家庭摘要'}</strong>
          <span>{isDemo ? '登入後才會讀取所屬家庭；示範資料不會儲存。' : '家庭成員資格不等於資料查看權；每項摘要均需本人允許。'}</span>
        </div>
      </div>

      <HouseholdSettings
        sessionStatus={sessionStatus}
        member={member}
        status={householdStatus}
        data={householdData}
        error={householdError}
        pendingInvitation={pendingInvitation}
        onLogin={onLogin}
        onCreateHousehold={onCreateHousehold}
        onCreateInvitation={onCreateInvitation}
        onRevokeInvitation={onRevokeInvitation}
        onAcceptInvitation={onAcceptInvitation}
        onUpdateSharing={onUpdateSharing}
      />

      {sessionStatus === 'checking' || (sessionStatus === 'authenticated' && (status === 'idle' || status === 'loading') && !board) ? (
        <div className="board-state" role="status"><RefreshCw className="sync-spinner" /><h3>正在準備家庭看板…</h3></div>
      ) : null}

      {sessionStatus === 'authenticated' && status === 'setup-required' ? (
        <div className="board-state">
          <LockKeyhole className="empty-icon" />
          <h3>{householdData ? '等待成員分享摘要' : '先完成家庭設定'}</h3>
          <p>{householdData ? '目前沒有其他成員向你開啟摘要。每位家人可在上方逐項選擇分享範圍。' : '請在上方建立家庭，或使用家人傳來的邀請連結加入。'}</p>
        </div>
      ) : null}

      {sessionStatus === 'authenticated' && status === 'error' ? (
        <div className="board-state" role="alert"><h3>暫時未能載入</h3><p>{error}</p><button className="board-refresh-button" type="button" onClick={onRefresh}>再試一次</button></div>
      ) : null}

      {board ? <div className="family-member-grid">{board.members.map((member) => <MemberCard key={member.memberId} member={member} />)}</div> : null}

      <div className="family-board-boundary">
        <LockKeyhole size={18} />
        <span>客廳模式不顯示體重、體脂、腰圍、食物相片、飲食內容、備註或登入電郵。</span>
      </div>
    </section>
  );
}

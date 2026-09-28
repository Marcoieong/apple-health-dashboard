import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Clipboard, Link2, LockKeyhole, MailPlus, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import type { HouseholdSharingScope, HouseholdSnapshot } from '../../contracts/household';
import type { FamilyMember, FamilySessionStatus } from '../../hooks/useFamilySession';
import type { HouseholdStatus } from '../../hooks/useHousehold';

interface InvitationResult {
  invitationId: string;
  token: string;
  expiresAt: string;
}

interface HouseholdSettingsProps {
  sessionStatus: FamilySessionStatus;
  member?: FamilyMember;
  status: HouseholdStatus;
  data?: HouseholdSnapshot;
  error?: string;
  pendingInvitation: boolean;
  onLogin: () => void;
  onCreateHousehold: (name: string) => Promise<void>;
  onCreateInvitation: (email: string) => Promise<InvitationResult>;
  onRevokeInvitation: (invitationId: string) => Promise<void>;
  onAcceptInvitation: () => Promise<void>;
  onUpdateSharing: (viewerMemberId: string, scopes: HouseholdSharingScope[]) => Promise<void>;
}

const scopeOptions: Array<{ value: HouseholdSharingScope; label: string; detail: string }> = [
  { value: 'score', label: '健康評分', detail: '只分享總分，不分享評分明細' },
  { value: 'activity_status', label: '活動狀態', detail: '只分享達標狀態及摘要' },
  { value: 'sleep_status', label: '睡眠狀態', detail: '只分享達標狀態及摘要' },
  { value: 'weekly_direction', label: '每週方向', detail: '改善、持平或回落' },
  { value: 'advice', label: '簡短建議', detail: '不包含私人原始數據' }
];

function invitationLink(token: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set('section', 'family-board');
  url.searchParams.set('invite', token);
  return url.toString();
}

function SharingRow({
  displayName,
  viewerMemberId,
  initialScopes,
  onSave
}: {
  displayName: string;
  viewerMemberId: string;
  initialScopes: HouseholdSharingScope[];
  onSave: HouseholdSettingsProps['onUpdateSharing'];
}) {
  const [selected, setSelected] = useState<HouseholdSharingScope[]>(initialScopes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setSelected(initialScopes), [initialScopes]);

  const toggle = (scope: HouseholdSharingScope) => {
    setSaved(false);
    setSelected((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(viewerMemberId, selected);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="sharing-member-row">
      <div className="sharing-member-heading">
        <div>
          <strong>{displayName}</strong>
          <span>選擇這位成員可看到你的哪些摘要</span>
        </div>
        <span className="sharing-count">{selected.length}/5 項</span>
      </div>
      <div className="sharing-scope-grid">
        {scopeOptions.map((option) => (
          <label className="sharing-scope-option" key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span><strong>{option.label}</strong><small>{option.detail}</small></span>
          </label>
        ))}
      </div>
      <div className="sharing-actions">
        <span>{selected.length === 0 ? '目前不向此成員分享任何健康摘要。' : '只會分享以上摘要，不會分享原始健康資料。'}</span>
        <button className="board-refresh-button" type="button" onClick={save} disabled={saving}>
          {saved ? <Check size={17} /> : <ShieldCheck size={17} />}
          {saving ? '儲存中' : saved ? '已儲存' : '儲存授權'}
        </button>
      </div>
    </article>
  );
}

export function HouseholdSettings({
  sessionStatus,
  member,
  status,
  data,
  error,
  pendingInvitation,
  onLogin,
  onCreateHousehold,
  onCreateInvitation,
  onRevokeInvitation,
  onAcceptInvitation,
  onUpdateSharing
}: HouseholdSettingsProps) {
  const [householdName, setHouseholdName] = useState('我的家庭');
  const [inviteEmail, setInviteEmail] = useState('');
  const [createdInvitation, setCreatedInvitation] = useState<InvitationResult>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const shareTargets = useMemo(
    () => data?.members.filter((item) => !item.isCurrentUser) ?? [],
    [data]
  );

  const perform = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
      setMessage(success);
    } catch {
      // The hook supplies a privacy-safe, user-facing error message.
    } finally {
      setBusy(false);
    }
  };

  const createHousehold = (event: FormEvent) => {
    event.preventDefault();
    void perform(() => onCreateHousehold(householdName), '家庭已建立。你現在可以邀請家人。');
  };

  const createInvitation = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    void onCreateInvitation(inviteEmail).then((result) => {
      setCreatedInvitation(result);
      setInviteEmail('');
      setMessage('邀請已建立。請把下方連結私下傳給指定家人。');
    }).catch(() => undefined).finally(() => setBusy(false));
  };

  const copyInvitation = async () => {
    if (!createdInvitation) return;
    await navigator.clipboard.writeText(invitationLink(createdInvitation.token));
    setMessage('邀請連結已複製。');
  };

  return (
    <details className="household-settings" open={pendingInvitation || status === 'setup-required'}>
      <summary>
        <span><ShieldCheck size={20} /><strong>家庭設定與分享權限</strong></span>
        <small>{data ? `${data.household.name} · ${data.members.length} 位成員` : '建立或加入家庭'}</small>
      </summary>
      <div className="household-settings-content">
        <div className="household-privacy-note">
          <LockKeyhole size={19} />
          <p><strong>先加入，再逐項授權</strong><span>加入家庭不會自動分享健康資料；每位成員只可看到你親自開啟的摘要。</span></p>
        </div>

        {sessionStatus !== 'authenticated' ? (
          <div className="household-setup-panel">
            <div><h3>{pendingInvitation ? '你收到家庭邀請' : '登入後管理家庭'}</h3><p>使用邀請指定的電郵登入，才能加入正確家庭。</p></div>
            <button className="primary-button" type="button" onClick={onLogin}>登入家庭帳戶</button>
          </div>
        ) : null}

        {sessionStatus === 'authenticated' && pendingInvitation ? (
          <div className="household-setup-panel invite-ready">
            <div><h3>接受家庭邀請</h3><p>目前登入：{member?.email}。接受後仍不會自動分享健康資料。</p></div>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void perform(onAcceptInvitation, '已加入家庭。')}>
              <UserRoundPlus size={18} />{busy ? '處理中' : '接受邀請'}
            </button>
          </div>
        ) : null}

        {sessionStatus === 'authenticated' && status === 'setup-required' && !pendingInvitation ? (
          <form className="household-create-form" onSubmit={createHousehold}>
            <div><h3>建立第一個家庭</h3><p>建立後你會是家庭管理者，可產生指定電郵的一次性邀請。</p></div>
            <label><span>家庭名稱</span><input value={householdName} maxLength={80} required onChange={(event) => setHouseholdName(event.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? '建立中' : '建立家庭'}</button>
          </form>
        ) : null}

        {sessionStatus === 'authenticated' && data ? (
          <>
            <div className="household-summary-row">
              <div><span>目前帳戶</span><strong>{member?.name || member?.email}</strong></div>
              <div><span>家庭角色</span><strong>{data.household.role === 'owner' ? '管理者' : '成員'}</strong></div>
              <div><span>私隱預設</span><strong>不分享</strong></div>
            </div>

            {data.household.role === 'owner' ? (
              <section className="household-settings-section" aria-labelledby="invite-family-title">
                <div className="household-section-heading"><MailPlus size={19} /><div><h3 id="invite-family-title">邀請家庭成員</h3><p>邀請只限指定電郵，有效期七日；請用私人訊息傳送。</p></div></div>
                <form className="household-invite-form" onSubmit={createInvitation}>
                  <label><span>家人登入電郵</span><input type="email" autoComplete="email" value={inviteEmail} required onChange={(event) => setInviteEmail(event.target.value)} placeholder="family@example.com" /></label>
                  <button className="primary-button" type="submit" disabled={busy}><MailPlus size={18} />{busy ? '建立中' : '建立邀請'}</button>
                </form>
                {createdInvitation ? (
                  <div className="created-invitation" role="status">
                    <Link2 size={18} /><div><strong>一次性邀請連結已產生</strong><span>到期：{new Date(createdInvitation.expiresAt).toLocaleString('zh-HK')}</span></div>
                    <button className="board-refresh-button" type="button" onClick={() => void copyInvitation()}><Clipboard size={17} />複製連結</button>
                  </div>
                ) : null}
                {data.invitations.length ? (
                  <div className="pending-invitations">
                    {data.invitations.map((invitation) => (
                      <div key={invitation.id}><span><strong>{invitation.email}</strong><small>有效至 {new Date(invitation.expiresAt).toLocaleDateString('zh-HK')}</small></span><button type="button" aria-label={`撤銷 ${invitation.email} 的邀請`} onClick={() => void perform(() => onRevokeInvitation(invitation.id), '邀請已撤銷。')}><X size={17} />撤銷</button></div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="household-settings-section" aria-labelledby="sharing-title">
              <div className="household-section-heading"><ShieldCheck size={19} /><div><h3 id="sharing-title">我的逐項分享授權</h3><p>以下設定控制每位家人可看到你的摘要。關閉全部即代表不分享。</p></div></div>
              {shareTargets.length ? shareTargets.map((target) => (
                <SharingRow key={target.memberId} displayName={target.displayName} viewerMemberId={target.memberId} initialScopes={target.sharedByMe} onSave={onUpdateSharing} />
              )) : <p className="household-empty-copy">尚未有其他家庭成員；家人接受邀請後，逐項授權設定會在這裡出現。</p>}
            </section>
          </>
        ) : null}

        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {message ? <p className="form-message" role="status">{message}</p> : null}
      </div>
    </details>
  );
}

import {
  CalendarDays,
  Clock3,
  ImageOff,
  LockKeyhole,
  LogIn,
  LogOut
} from 'lucide-react';
import { useMemo } from 'react';
import {
  formatFoodJournalDate,
  formatMealTime,
  groupFoodJournalEntries
} from '../../lib/foodJournal';
import { todayKey } from '../../lib/date';
import {
  mealTypeLabels,
  type FoodJournalEntry
} from '../../models/foodJournal';
import type { FamilyMember, FamilyViewStatus } from '../../hooks/useFoodJournal';
import { FamilyShortcutPanel } from './FamilyShortcutPanel';

interface FoodJournalProps {
  entries: readonly FoodJournalEntry[];
  mode: 'demo' | 'private';
  status: FamilyViewStatus;
  member?: FamilyMember;
  error?: string;
  login: () => void;
  logout: () => void;
  retry: () => Promise<void>;
}

export function FoodJournal({
  entries,
  mode,
  status,
  member,
  error,
  login,
  logout,
  retry
}: FoodJournalProps) {
  const days = useMemo(() => groupFoodJournalEntries(entries), [entries]);
  const today = todayKey();
  const isPrivate = mode === 'private';
  const memberLabel = member?.name || member?.email;

  return (
    <div className="page-stack food-journal-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Food journal · Read only</p>
          <h2>飲食日誌</h2>
          <p>記錄食物種類與飲食模式，不計算卡路里或要求量化份量。</p>
        </div>
        <div className="journal-overview" aria-label="飲食日誌顯示範圍">
          <span>{isPrivate ? '私人範圍' : '示範範圍'}</span>
          <strong>{days.length} 日 · {entries.length} 餐</strong>
          <small>{isPrivate ? `${memberLabel ?? '家庭成員'} · 只讀` : 'Demo Data · 只讀'}</small>
        </div>
      </section>

      <aside className="journal-scope-note" aria-label="相片私隱說明">
        <span className="summary-icon" aria-hidden="true">
          <LockKeyhole size={20} />
        </span>
        <div>
          <strong>{isPrivate ? `${memberLabel ?? '家庭成員'}的私人空間` : '家庭私人紀錄'}</strong>
          {isPrivate ? (
            <p>
              只顯示你的餐食紀錄與受保護相片。其他家庭成員不能查看；管理員也不會預設取得你的健康資料。
            </p>
          ) : (
            <p>
              頁面目前只顯示 Demo Data。登入獲邀請的家庭帳戶後，才會載入該成員自己的私人紀錄。
            </p>
          )}
        </div>
        {isPrivate ? (
          <button className="journal-lock-button" type="button" onClick={logout}>
            <LogOut size={17} aria-hidden="true" />
            登出
          </button>
        ) : null}
      </aside>

      {!isPrivate ? (
        <section className="family-login-panel" aria-labelledby="family-login-heading">
          <div>
            <strong id="family-login-heading">登入你的家庭帳戶</strong>
            <p>登入資料保存在加密、安全 Cookie；瀏覽器不會接觸 Auth0 權杖。</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={status === 'error' ? () => void retry() : login}
            disabled={status === 'checking' || status === 'loading'}
          >
            <LogIn size={17} aria-hidden="true" />
            {status === 'checking' || status === 'loading'
              ? '正在檢查登入…'
              : status === 'error'
                ? '重新檢查'
                : '登入家庭帳戶'}
          </button>
        </section>
      ) : null}

      {error ? (
        <p className="journal-access-error" role="alert">
          {error}
        </p>
      ) : null}

      {isPrivate ? <FamilyShortcutPanel /> : null}

      {days.length ? (
        <div className="journal-days">
          {days.map((day) => (
            <section
              className="journal-day"
              key={day.date}
              aria-labelledby={`journal-day-${day.date}`}
            >
              <header className="journal-day-header">
                <span className="journal-date-icon" aria-hidden="true">
                  <CalendarDays size={20} />
                </span>
                <div>
                  <h3 id={`journal-day-${day.date}`}>
                    <time dateTime={day.date}>
                      {formatFoodJournalDate(day.date, today)}
                    </time>
                  </h3>
                  <p>
                    {day.entries.length} 餐{isPrivate ? '私人' : '示範'}紀錄
                  </p>
                </div>
              </header>

              <div className="journal-meal-list">
                {day.entries.map((entry) => (
                  <article className="journal-meal-card" key={entry.id}>
                    {entry.photo.kind === 'authenticated-thumbnail' ? (
                      <img
                        className="journal-photo"
                        src={entry.photo.src}
                        alt={entry.photo.alt}
                        width={entry.photo.width}
                        height={entry.photo.height}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="journal-photo-placeholder"
                        role="img"
                        aria-label={entry.photo.alt}
                      >
                        <ImageOff size={28} aria-hidden="true" />
                        <strong>
                          {isPrivate ? '這餐沒有可顯示的相片' : '相片預留位置'}
                        </strong>
                        <span>
                          {isPrivate
                            ? `${entry.privatePhotoCount ?? 0} 張私人相片`
                            : '未載入私人相片'}
                        </span>
                      </div>
                    )}

                    <div className="journal-meal-content">
                      <div className="journal-meal-heading">
                        <div>
                          <span className="meal-type">
                            {mealTypeLabels[entry.mealType]}
                          </span>
                          <h3>{entry.foods.join('、')}</h3>
                        </div>
                        <time
                          dateTime={entry.occurredAt ?? entry.recordedAt}
                          title={
                            entry.occurredAt
                              ? '用餐時間'
                              : '私人紀錄寫入時間'
                          }
                        >
                          <Clock3 size={15} aria-hidden="true" />
                          {entry.occurredAt
                            ? formatMealTime(entry)
                            : `寫入 ${formatMealTime(entry)}`}
                        </time>
                      </div>

                      <dl className="journal-metadata">
                        <div>
                          <dt>食物種類</dt>
                          <dd>{entry.foods.join(' · ')}</dd>
                        </div>
                        <div>
                          <dt>烹調方式</dt>
                          <dd>
                            {entry.cookingMethods?.join(' · ') ?? '尚未標示'}
                          </dd>
                        </div>
                      </dl>

                      {entry.notes ? (
                        <p className="journal-note">{entry.notes}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="journal-empty">
          <CalendarDays size={26} aria-hidden="true" />
          <h3>{isPrivate ? '尚未有私人飲食紀錄' : '尚未有飲食紀錄'}</h3>
          <p>
            {isPrivate
              ? '使用 iPhone Shortcut 寫入後，紀錄會按澳門日期與餐別顯示。'
              : '登入家庭帳戶後，Shortcut 寫入的私人資料會顯示在這裡。'}
          </p>
        </section>
      )}
    </div>
  );
}

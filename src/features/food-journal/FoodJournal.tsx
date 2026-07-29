import {
  CalendarDays,
  Clock3,
  ImageOff,
  KeyRound,
  LockKeyhole,
  LogOut
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
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

interface FoodJournalProps {
  entries: readonly FoodJournalEntry[];
  mode: 'demo' | 'private';
  status: 'locked' | 'loading' | 'unlocked' | 'error';
  error?: string;
  unlock: (accessCode: string) => Promise<void>;
  lock: () => void;
}

export function FoodJournal({
  entries,
  mode,
  status,
  error,
  unlock,
  lock
}: FoodJournalProps) {
  const days = useMemo(() => groupFoodJournalEntries(entries), [entries]);
  const today = todayKey();
  const [accessCode, setAccessCode] = useState('');
  const isPrivate = mode === 'private';

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedCode = accessCode;
    setAccessCode('');
    await unlock(submittedCode);
  }

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
          <small>{isPrivate ? '已安全解鎖 · 只讀' : 'Demo Data · 只讀'}</small>
        </div>
      </section>

      <aside className="journal-scope-note" aria-label="相片私隱說明">
        <span className="summary-icon" aria-hidden="true">
          <LockKeyhole size={20} />
        </span>
        <div>
          <strong>{isPrivate ? '私人紀錄已解鎖' : '私人紀錄已鎖定'}</strong>
          {isPrivate ? (
            <p>
              只讀顯示私人資料庫的餐食標籤；相片保留在私人物件儲存，不在公開頁載入。存取碼不會保存於瀏覽器。
            </p>
          ) : (
            <p>
              頁面目前只顯示 Demo Data。輸入 Shortcut 存取碼可在本次頁面載入私人餐食紀錄，關閉或重整後需要重新解鎖。
            </p>
          )}
        </div>
        {isPrivate ? (
          <button className="journal-lock-button" type="button" onClick={lock}>
            <LogOut size={17} aria-hidden="true" />
            鎖定
          </button>
        ) : null}
      </aside>

      {!isPrivate ? (
        <form className="journal-private-access" onSubmit={handleUnlock}>
          <label htmlFor="private-access-code">
            <span>私人存取碼</span>
            <input
              id="private-access-code"
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              autoComplete="off"
              spellCheck="false"
              required
              disabled={status === 'loading'}
              placeholder="貼上 Shortcut 存取碼"
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={status === 'loading'}
          >
            <KeyRound size={17} aria-hidden="true" />
            {status === 'loading' ? '正在解鎖…' : '載入私人紀錄'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="journal-access-error" role="alert">
          {error}
        </p>
      ) : null}

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
                          {isPrivate ? '私人相片已安全保存' : '相片預留位置'}
                        </strong>
                        <span>
                          {isPrivate
                            ? `${entry.privatePhotoCount ?? 0} 張 · 不在公開頁載入`
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
              : '解鎖私人紀錄後，Shortcut 寫入的資料會顯示在這裡。'}
          </p>
        </section>
      )}
    </div>
  );
}

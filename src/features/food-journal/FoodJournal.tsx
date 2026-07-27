import { CalendarDays, Clock3, ImageOff, LockKeyhole } from 'lucide-react';
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

interface FoodJournalProps {
  entries: readonly FoodJournalEntry[];
}

export function FoodJournal({ entries }: FoodJournalProps) {
  const days = useMemo(() => groupFoodJournalEntries(entries), [entries]);
  const today = todayKey();

  return (
    <div className="page-stack food-journal-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Food journal · Read only</p>
          <h2>飲食日誌</h2>
          <p>記錄食物種類與飲食模式，不計算卡路里或要求量化份量。</p>
        </div>
        <div className="journal-overview" aria-label="飲食日誌示範範圍">
          <span>示範範圍</span>
          <strong>{days.length} 日 · {entries.length} 餐</strong>
          <small>只讀前端</small>
        </div>
      </section>

      <aside className="journal-scope-note" aria-label="相片私隱說明">
        <span className="summary-icon" aria-hidden="true">
          <LockKeyhole size={20} />
        </span>
        <div>
          <strong>私人相片尚未接入</strong>
          <p>
            目前只準備展示框架；所有相片位置均為示範 placeholder，沒有手機上傳、真實相片網址或對話識別資料。
          </p>
        </div>
      </aside>

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
                  <p>{day.entries.length} 餐示範紀錄</p>
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
                        <strong>相片預留位置</strong>
                        <span>未載入私人相片</span>
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
                        <time dateTime={entry.occurredAt}>
                          <Clock3 size={15} aria-hidden="true" />
                          {formatMealTime(entry)}
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
          <h3>尚未有飲食紀錄</h3>
          <p>日後接入經批准的資料來源後，紀錄會按日期與餐別顯示。</p>
        </section>
      )}
    </div>
  );
}

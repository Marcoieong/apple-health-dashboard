import { Check, MoonStar, Sparkles } from 'lucide-react';
import { healthTargets } from '../../data/healthTargets';
import { getRecoveryAdvice } from '../../lib/advice';
import { formatDateZh } from '../../lib/date';
import { calculateDailyScore } from '../../lib/scoring';
import type { DailyHealthRecord } from '../../models/health';
import { MetricProgress } from '../../components/MetricProgress';

const ratingLabels = {
  Excellent: '卓越',
  'Very Good': '非常好',
  Good: '良好',
  'Needs Improvement': '需要改善',
  'Reset Tomorrow': '明天重新開始'
} as const;

interface DailyDashboardProps {
  record: DailyHealthRecord;
  weeklyChange: number | null;
}

export function DailyDashboard({ record, weeklyChange }: DailyDashboardProps) {
  const score = calculateDailyScore(record);
  const advice = getRecoveryAdvice(record);
  const stepsRemaining = Math.max(0, healthTargets.steps.minimum - (record.steps ?? 0));
  const minutesRemaining = Math.max(
    0,
    healthTargets.exerciseMinutes.minimum - (record.exerciseMinutes ?? 0)
  );
  const meals = [
    record.lunchHighProtein,
    record.dinnerHighProtein,
    record.vegetablesCompleted,
    record.noSugaryDrink,
    record.noLateNightMeal
  ];
  const completedMeals = meals.filter(Boolean).length;

  return (
    <div className="page-stack">
      <section className="hero-grid" aria-labelledby="today-title">
        <div className="score-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">今日狀態</p>
              <h2 id="today-title">{formatDateZh(record.date)}</h2>
            </div>
          </div>
          <div className="score-layout">
            <div
              className="score-ring"
              style={{ '--score': `${score.total * 3.6}deg` } as React.CSSProperties}
              aria-label={`今日健康總分 ${score.total} 分`}
            >
              <div>
                <strong>{score.total}</strong>
                <span>/ 100</span>
              </div>
            </div>
            <div className="score-copy">
              <span className={score.total >= 80 ? 'status-badge met' : 'status-badge'}>
                {score.total >= 80 ? '今日達標' : '仍可改善'}
              </span>
              <h3>{ratingLabels[score.rating]}</h3>
              <p>{score.rating}</p>
              {!score.isComplete && (
                <small>{score.missingFields.length} 項評分資料尚未匯入</small>
              )}
            </div>
          </div>
        </div>

        <div className="action-panel">
          <span className="action-icon" aria-hidden="true">
            <Sparkles size={22} />
          </span>
          <p className="eyebrow">今晚一件事</p>
          <h2>{advice.title}</h2>
          <p>{advice.message}</p>
          <div className="remaining-grid">
            <div>
              <strong>{stepsRemaining.toLocaleString()}</strong>
              <span>尚差步數</span>
            </div>
            <div>
              <strong>{minutesRemaining}</strong>
              <span>尚差分鐘</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section" aria-labelledby="activity-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">活動與恢復</p>
            <h2 id="activity-title">今天的進度</h2>
          </div>
          <p className="week-signal">
            本週較上週
            <strong className={(weeklyChange ?? 0) >= 0 ? 'positive' : 'negative'}>
              {weeklyChange === null
                ? ' 資料不足'
                : ` ${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(1)} 分`}
            </strong>
          </p>
        </div>
        <div className="progress-list">
          <MetricProgress
            label="活動卡路里"
            value={record.activeCalories}
            target={healthTargets.activeCalories.minimum}
            unit="kcal"
          />
          <MetricProgress
            label="步數"
            value={record.steps}
            target={healthTargets.steps.minimum}
            unit="步"
          />
          <MetricProgress
            label="運動時間"
            value={record.exerciseMinutes}
            target={healthTargets.exerciseMinutes.minimum}
            unit="分鐘"
          />
          <MetricProgress
            label="睡眠"
            value={record.sleepHours}
            target={healthTargets.sleepHours.minimum}
            unit="小時"
            digits={1}
          />
        </div>
      </section>

      <section className="stats-strip" aria-label="身體與習慣指標">
        <div><span>體重</span><strong>{record.weightKg?.toFixed(1) ?? '—'} <small>kg</small></strong></div>
        <div><span>體脂率</span><strong>{record.bodyFatPercent?.toFixed(1) ?? '—'} <small>%</small></strong></div>
        <div><span>腰圍</span><strong>{record.waistCm?.toFixed(1) ?? '—'} <small>cm</small></strong></div>
        <div><span>飲食完成</span><strong>{completedMeals} <small>/ 5</small></strong></div>
        <div>
          <span>力量訓練</span>
          <strong className={record.strengthTraining ? 'habit-done' : ''}>
            {record.strengthTraining ? <><Check size={18} /> 已完成</> : '未完成'}
          </strong>
        </div>
      </section>

      <p className="medical-note">
        <MoonStar size={16} aria-hidden="true" />
        本工具只用於健康習慣追蹤，不提供醫療診斷或治療建議。
      </p>
    </div>
  );
}

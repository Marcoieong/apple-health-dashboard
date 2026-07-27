import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Utensils } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatDateZh, formatShortDate } from '../../lib/date';
import { calculateDailyScore } from '../../lib/scoring';
import { calculateWeeklySummary } from '../../lib/summaries';
import type { DailyHealthRecord } from '../../models/health';

interface WeeklyTrendsProps {
  records: DailyHealthRecord[];
}

function display(value: number | null, unit = '', digits = 0) {
  return value === null ? '—' : `${value.toFixed(digits)}${unit}`;
}

export function WeeklyTrends({ records }: WeeklyTrendsProps) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.slice(-7);
  const previous = sorted.slice(-14, -7);
  const summary = calculateWeeklySummary(current, previous);
  const chartData = summary.records.map((record) => ({
    date: formatShortDate(record.date),
    分數: calculateDailyScore(record).total,
    步數: record.steps,
    活動卡路里: record.activeCalories,
    運動分鐘: record.exerciseMinutes,
    睡眠: record.sleepHours,
    體重: record.weightKg
  }));
  const TrendIcon =
    summary.scoreDirection === 'up'
      ? ArrowUpRight
      : summary.scoreDirection === 'down'
        ? ArrowDownRight
        : ArrowRight;

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <p className="eyebrow">最近 7 日</p>
          <h2>每週趨勢</h2>
          <p>
            {summary.startDate && summary.endDate
              ? `${formatDateZh(summary.startDate, false)} 至 ${formatDateZh(summary.endDate, false)}`
              : '尚未有日期範圍'}
          </p>
        </div>
        <div className="weekly-score">
          <span>本週平均</span>
          <strong>{display(summary.averageScore, ' 分', 1)}</strong>
          <small className={summary.scoreDirection === 'down' ? 'negative' : 'positive'}>
            <TrendIcon size={16} />
            {summary.scoreChange === null
              ? '上週資料不足'
              : `較上週 ${summary.scoreChange >= 0 ? '+' : ''}${summary.scoreChange.toFixed(1)}`}
          </small>
        </div>
      </section>

      <section className="insight-band">
        <div>
          <span>本週主要瓶頸</span>
          <strong>{summary.mainBottleneck}</strong>
        </div>
        <p>先改善一個最弱環節，比同時追逐所有數字更容易持續。</p>
      </section>

      <section className="chart-section" aria-labelledby="score-chart-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">每日表現</p>
            <h3 id="score-chart-title">健康分數與步數</h3>
          </div>
          <div className="legend">
            <span><i className="legend-dot teal" />分數</span>
            <span><i className="legend-dot coral" />步數</span>
          </div>
        </div>
        <div className="chart-wrap" role="img" aria-label="最近七日健康分數與步數折線圖">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis yAxisId="score" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis yAxisId="steps" orientation="right" width={52} tickFormatter={(value) => `${value / 1000}k`} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line yAxisId="score" type="monotone" dataKey="分數" stroke="#0b857a" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
              <Line yAxisId="steps" type="monotone" dataKey="步數" stroke="#f4775c" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="chart-grid">
        <section className="chart-section" aria-labelledby="activity-chart-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">活動負荷</p>
              <h3 id="activity-chart-title">卡路里與運動分鐘</h3>
            </div>
          </div>
          <div className="chart-wrap small" role="img" aria-label="每日活動卡路里與運動分鐘趨勢圖">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b857a" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0b857a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="活動卡路里" stroke="#0b857a" fill="url(#activityFill)" isAnimationActive={false} />
                <Line type="monotone" dataKey="運動分鐘" stroke="#f4775c" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="chart-section" aria-labelledby="recovery-chart-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">身體變化</p>
              <h3 id="recovery-chart-title">睡眠與體重</h3>
            </div>
          </div>
          <div className="chart-wrap small" role="img" aria-label="每日睡眠時數與體重趨勢圖">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis yAxisId="sleep" domain={[5, 9]} tickLine={false} axisLine={false} />
                <YAxis yAxisId="weight" orientation="right" domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line yAxisId="sleep" type="monotone" dataKey="睡眠" stroke="#0b857a" strokeWidth={3} isAnimationActive={false} />
                <Line yAxisId="weight" type="monotone" dataKey="體重" stroke="#f4775c" strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="weekly-metrics" aria-label="每週摘要指標">
        <div><span>平均步數</span><strong>{display(summary.averageSteps, ' 步')}</strong></div>
        <div><span>活動卡路里</span><strong>{display(summary.averageActiveCalories, ' kcal')}</strong></div>
        <div><span>運動時間</span><strong>{display(summary.averageExerciseMinutes, ' 分鐘')}</strong></div>
        <div><span>平均睡眠</span><strong>{display(summary.averageSleepHours, ' 小時', 1)}</strong></div>
        <div><span>體重變化</span><strong>{display(summary.weightChangeKg, ' kg', 1)}</strong></div>
        <div><span>達標天數</span><strong>{summary.achievedDays} / {summary.records.length} 天</strong></div>
        <div className="metric-with-icon"><Utensils size={18} /><span>健康外食率</span><strong>{summary.healthyMealRate === null ? '—' : `${Math.round(summary.healthyMealRate * 100)}%`}</strong></div>
        <div className="metric-with-icon"><Dumbbell size={18} /><span>力量訓練</span><strong>{summary.strengthTrainingCount} 次</strong></div>
      </section>
    </div>
  );
}

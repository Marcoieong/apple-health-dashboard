import { CheckCircle2, Target } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatShortDate } from '../../lib/date';
import { calculateMonthlySummary } from '../../lib/summaries';
import type { DailyHealthRecord } from '../../models/health';

interface MonthlyProgressProps {
  records: DailyHealthRecord[];
  month: string;
}

function changeLabel(value: number | null, unit: string) {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} ${unit}`;
}

function average(records: DailyHealthRecord[], field: keyof DailyHealthRecord) {
  const values = records
    .map((record) => record[field])
    .filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function MonthlyProgress({ records, month }: MonthlyProgressProps) {
  const summary = calculateMonthlySummary(records, month);
  const recentRecords = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
  const recentChartData = recentRecords.map((record) => ({
    date: formatShortDate(record.date),
    步數: record.steps,
    睡眠: record.sleepHours
  }));
  const recentAverages = {
    steps: average(recentRecords, 'steps'),
    activeCalories: average(recentRecords, 'activeCalories'),
    exerciseMinutes: average(recentRecords, 'exerciseMinutes'),
    sleepHours: average(recentRecords, 'sleepHours')
  };
  const chartData = summary.records.map((record) => ({
    date: formatShortDate(record.date),
    體重: record.weightKg,
    腰圍: record.waistCm
  }));
  const monthLabel = new Intl.DateTimeFormat('zh-Hant-MO', {
    year: 'numeric',
    month: 'long'
  }).format(new Date(`${month}-01T12:00:00`));

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <p className="eyebrow">長期方向</p>
          <h2>每月進度</h2>
          <p>{monthLabel} · 共 {summary.records.length} 日紀錄</p>
        </div>
        <div className="achievement-block">
          <span>月度達標率</span>
          <strong>{summary.achievementRate === null ? '—' : `${Math.round(summary.achievementRate * 100)}%`}</strong>
        </div>
      </section>

      <section className="monthly-change" aria-label="本月身體數據變化">
        <div><span>月初體重</span><strong>{summary.startWeightKg?.toFixed(1) ?? '—'} <small>kg</small></strong></div>
        <div><span>月末體重</span><strong>{summary.endWeightKg?.toFixed(1) ?? '—'} <small>kg</small></strong></div>
        <div><span>體重變化</span><strong>{changeLabel(summary.weightChangeKg, 'kg')}</strong></div>
        <div><span>體脂變化</span><strong>{changeLabel(summary.bodyFatChangePercent, '%')}</strong></div>
        <div><span>腰圍變化</span><strong>{changeLabel(summary.waistChangeCm, 'cm')}</strong></div>
      </section>

      <section className="chart-section recent-health-section" aria-labelledby="recent-health-title">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">已同步資料</p>
            <h3 id="recent-health-title">最近 30 日活動與睡眠</h3>
            <p className="chart-range">
              {recentRecords.length
                ? `${formatShortDate(recentRecords[0].date)}–${formatShortDate(recentRecords.at(-1)?.date ?? recentRecords[0].date)} · ${recentRecords.length} 日`
                : '尚未有同步資料'}
            </p>
          </div>
        </div>
        <div className="recent-health-metrics" aria-label="最近30日平均">
          <div><span>平均步數</span><strong>{recentAverages.steps === null ? '—' : Math.round(recentAverages.steps).toLocaleString()}</strong></div>
          <div><span>活動熱量</span><strong>{recentAverages.activeCalories === null ? '—' : `${Math.round(recentAverages.activeCalories)} kcal`}</strong></div>
          <div><span>運動時間</span><strong>{recentAverages.exerciseMinutes === null ? '—' : `${Math.round(recentAverages.exerciseMinutes)} 分鐘`}</strong></div>
          <div><span>平均睡眠</span><strong>{recentAverages.sleepHours === null ? '—' : `${recentAverages.sleepHours.toFixed(1)} 小時`}</strong></div>
        </div>
        <div className="chart-wrap recent-health-chart" role="img" aria-label="最近30日 Apple Health 活動與睡眠趨勢圖">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={recentChartData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis yAxisId="steps" tickLine={false} axisLine={false} width={56} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <YAxis yAxisId="sleep" orientation="right" tickLine={false} axisLine={false} width={34} unit="h" domain={[0, 'auto']} />
              <Tooltip />
              <Bar yAxisId="steps" dataKey="步數" fill="#0b857a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="sleep" type="monotone" dataKey="睡眠" stroke="#f4775c" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="monthly-layout">
        <section className="chart-section" aria-labelledby="monthly-chart-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">身體趨勢</p>
              <h3 id="monthly-chart-title">體重與腰圍</h3>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="本月體重與腰圍趨勢圖">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b857a" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#0b857a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="體重" stroke="#0b857a" fill="url(#weightFill)" strokeWidth={3} isAnimationActive={false} />
                <Area type="monotone" dataKey="腰圍" stroke="#f4775c" fill="transparent" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="summary-panel">
          <span className="summary-icon" aria-hidden="true"><Target size={22} /></span>
          <p className="eyebrow">本月總結</p>
          <h3>{summary.summary}</h3>
          <div className="summary-averages">
            <div><span>平均步數</span><strong>{summary.averageSteps?.toLocaleString() ?? '—'}</strong></div>
            <div><span>活動 kcal</span><strong>{summary.averageActiveCalories?.toLocaleString() ?? '—'}</strong></div>
            <div><span>平均睡眠</span><strong>{summary.averageSleepHours?.toFixed(1) ?? '—'} h</strong></div>
            <div><span>力量訓練</span><strong>{summary.strengthTrainingCount} 次</strong></div>
            <div><span>健康外食</span><strong>{summary.healthyMealRate === null ? '—' : `${Math.round(summary.healthyMealRate * 100)}%`}</strong></div>
          </div>
        </section>
      </div>

      <section className="priorities-section" aria-labelledby="priorities-title">
        <p className="eyebrow">下一個月</p>
        <h3 id="priorities-title">三個優先任務</h3>
        <ol>
          {summary.nextPriorities.map((priority) => (
            <li key={priority}>
              <CheckCircle2 size={20} aria-hidden="true" />
              <span>{priority}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

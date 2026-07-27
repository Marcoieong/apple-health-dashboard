interface MetricProgressProps {
  label: string;
  value?: number;
  target: number;
  unit: string;
  digits?: number;
}

export function MetricProgress({
  label,
  value,
  target,
  unit,
  digits = 0
}: MetricProgressProps) {
  const percent = Math.min(100, Math.max(0, ((value ?? 0) / target) * 100));
  const shown = value === undefined ? '—' : value.toLocaleString('zh-Hant-MO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
  return (
    <div className="metric-row">
      <div className="metric-row-heading">
        <span>{label}</span>
        <strong>
          {shown} <small>{unit}</small>
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${label}完成度`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>目標 {target.toLocaleString()} {unit}</small>
    </div>
  );
}

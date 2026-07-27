import { healthTargets } from '../data/healthTargets';
import type { DailyHealthRecord } from '../models/health';

export interface RecoveryAdvice {
  title: string;
  message: string;
}

export function getRecoveryAdvice(
  record?: DailyHealthRecord,
  hour = new Date().getHours()
): RecoveryAdvice {
  if (!record) {
    return {
      title: '先建立今天的基準',
      message: '等待 ChatGPT 匯入今天的活動與睡眠資料後，Dashboard 才能提供一項具體行動。'
    };
  }

  if ((record.sleepHours ?? 0) < healthTargets.sleepHours.minimum) {
    return {
      title: '今晚優先恢復',
      message: '提早準備睡眠並減少午後咖啡因；明天不用以大量運動補償。'
    };
  }

  const stepsRemaining = Math.max(0, healthTargets.steps.minimum - (record.steps ?? 0));
  const minutesRemaining = Math.max(
    0,
    healthTargets.exerciseMinutes.minimum - (record.exerciseMinutes ?? 0)
  );
  const caloriesRemaining = Math.max(
    0,
    healthTargets.activeCalories.minimum - (record.activeCalories ?? 0)
  );

  if (hour >= 20 && caloriesRemaining > 0) {
    return {
      title: '以溫和活動收尾',
      message: '時間較晚，做 10–20 分鐘低至中強度步行或室內單車即可，不必追求高強度。'
    };
  }
  if (stepsRemaining > 0) {
    const walkMinutes = Math.max(10, Math.ceil(stepsRemaining / 100));
    return {
      title: '飯後快走最直接',
      message: `尚差 ${stepsRemaining.toLocaleString()} 步，可分段快走約 ${walkMinutes} 分鐘。`
    };
  }
  if (minutesRemaining > 0) {
    return {
      title: '補一段有目的的活動',
      message: `尚差 ${minutesRemaining} 分鐘，可選快走、室內單車或簡單力量訓練。`
    };
  }
  return {
    title: '主要活動目標已達標',
    message: '今晚以恢復、補水和避免宵夜為主，毋須額外加操。'
  };
}

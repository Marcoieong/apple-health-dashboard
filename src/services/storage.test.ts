import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthRecordInput } from '../models/health';
import {
  STORAGE_KEY,
  clearAllRecords,
  deleteRecord,
  importRecords,
  loadRecords,
  saveRecord,
  updateRecord
} from './storage';

const validInput: HealthRecordInput = {
  date: '2026-07-27',
  steps: 9_200,
  activeCalories: 560,
  exerciseMinutes: 32,
  sleepHours: 7.25,
  strengthTraining: true,
  lunchHighProtein: true,
  dinnerHighProtein: true,
  vegetablesCompleted: true,
  noSugaryDrink: true,
  noLateNightMeal: true
};

describe('本機儲存服務', () => {
  beforeEach(() => localStorage.clear());

  it('可新增、讀取、更新及刪除紀錄', () => {
    const saved = saveRecord(validInput);
    expect(loadRecords(false)).toHaveLength(1);

    updateRecord(saved.id, { ...validInput, steps: 10_100 });
    expect(loadRecords(false)[0].steps).toBe(10_100);

    deleteRecord(saved.id);
    expect(loadRecords(false)).toEqual([]);
  });

  it('清除後保持空白，不會重新載入 Demo', () => {
    loadRecords();
    clearAllRecords();
    expect(loadRecords()).toEqual([]);
  });

  it('拒絕損壞資料並提供可理解錯誤', () => {
    localStorage.setItem(STORAGE_KEY, '{broken-json');
    expect(() => loadRecords(false)).toThrow('無法讀取本機健康資料');
  });

  it('匯入有效 JSON 並標記為 imported', () => {
    const result = importRecords(JSON.stringify({ records: [validInput] }));
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([]);
    expect(loadRecords(false)[0].source).toBe('imported');
  });

  it('匯入錯誤資料時不覆寫現有紀錄', () => {
    saveRecord(validInput);
    const result = importRecords(
      JSON.stringify({ records: [{ date: 'wrong', steps: -1 }] })
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('有效日期');
    expect(loadRecords(false)).toHaveLength(1);
  });
});

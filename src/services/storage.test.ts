// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthRecordInput } from '../models/health';
import { recordsToCsv } from './export';
import {
  STORAGE_KEY,
  clearAllRecords,
  deleteRecord,
  importRecords,
  loadRecords,
  saveRecord,
  updateRecord,
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
  noLateNightMeal: true,
  notes: '南灣湖快走',
};

describe('本機儲存及交換服務', () => {
  beforeEach(() => localStorage.clear());

  it('可新增、讀取、更新及刪除紀錄', () => {
    const saved = saveRecord(validInput);
    expect(loadRecords(false)).toHaveLength(1);
    expect(saved.source).toBe('manual');

    updateRecord(saved.id, { ...validInput, steps: 10_100 });
    expect(loadRecords(false)[0].steps).toBe(10_100);

    deleteRecord(saved.id);
    expect(loadRecords(false)).toEqual([]);
  });

  it('拒絕同日重複新增', () => {
    saveRecord(validInput);
    expect(() => saveRecord(validInput)).toThrow('該日期已有紀錄');
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
    expect(result.importedCount).toBe(1);
    expect(result.errors).toEqual([]);
    expect(loadRecords(false)[0].source).toBe('imported');
  });

  it('匯入錯誤資料時不覆寫現有紀錄', () => {
    saveRecord(validInput);
    const result = importRecords(JSON.stringify({ records: [{ date: 'wrong', steps: -1 }] }));
    expect(result.importedCount).toBe(0);
    expect(result.errors[0]).toContain('日期格式無效');
    expect(loadRecords(false)).toHaveLength(1);
  });

  it('匯入同日重複資料時保留第一筆並回報略過', () => {
    const result = importRecords(JSON.stringify({ records: [validInput, validInput] }));
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toContain('日期重複');
  });

  it('匯入不覆寫已有日期，只合併新日期', () => {
    saveRecord(validInput);
    const result = importRecords(JSON.stringify({
      records: [
        { ...validInput, steps: 1 },
        { ...validInput, date: '2026-07-28', steps: 10_000 },
      ],
    }));
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(loadRecords(false)).toHaveLength(2);
    expect(loadRecords(false).find((record) => record.date === validInput.date)?.steps).toBe(9_200);
  });

  it('CSV 正確處理逗號和引號', () => {
    const saved = saveRecord({ ...validInput, notes: '晚餐：「魚, 菜」' });
    const csv = recordsToCsv([saved]);
    expect(csv).toContain('"晚餐：「魚, 菜」"');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

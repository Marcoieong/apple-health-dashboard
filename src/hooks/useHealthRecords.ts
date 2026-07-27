import { useCallback, useState } from 'react';
import type { DailyHealthRecord, HealthRecordInput } from '../models/health';
import {
  clearAllRecords,
  deleteRecord,
  importRecords,
  loadRecords,
  saveRecord,
  updateRecord,
} from '../services/storage';

export function useHealthRecords() {
  const [initialState] = useState(() => {
    try {
      return { records: loadRecords(), error: null as string | null };
    } catch (reason) {
      return {
        records: [] as DailyHealthRecord[],
        error: reason instanceof Error ? reason.message : '無法讀取本機資料。',
      };
    }
  });
  const [records, setRecords] = useState(initialState.records);
  const [error, setError] = useState(initialState.error);

  const refresh = useCallback(() => {
    const next = loadRecords(false);
    setRecords(next);
    setError(null);
    return next;
  }, []);

  const save = useCallback((input: HealthRecordInput, id?: string) => {
    try {
      if (id) updateRecord(id, input);
      else saveRecord(input);
      refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能儲存紀錄。');
      return false;
    }
  }, [refresh]);

  const remove = useCallback((id: string) => {
    try {
      deleteRecord(id);
      refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能刪除紀錄。');
      return false;
    }
  }, [refresh]);

  const clear = useCallback(() => {
    try {
      clearAllRecords();
      setRecords([]);
      setError(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能清除紀錄。');
      return false;
    }
  }, []);

  const importJson = useCallback((json: string) => {
    const result = importRecords(json);
    setRecords(result.records);
    setError(result.errors.length ? result.errors.join(' ') : null);
    return result;
  }, []);

  return { records, error, setError, save, remove, clear, importJson };
}

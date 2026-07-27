import { useCallback, useState } from 'react';
import type { DailyHealthRecord, HealthRecordInput } from '../models/health';
import {
  clearAllRecords,
  deleteRecord,
  importRecords,
  loadRecords,
  saveRecord,
  updateRecord
} from '../services/storage';

export function useHealthRecords() {
  const [initialState] = useState(() => {
    try {
      return { records: loadRecords(), error: null as string | null };
    } catch (reason) {
      return {
        records: [] as DailyHealthRecord[],
        error: reason instanceof Error ? reason.message : '無法讀取本機資料。'
      };
    }
  });
  const [records, setRecords] = useState<DailyHealthRecord[]>(initialState.records);
  const [error, setError] = useState<string | null>(initialState.error);

  const refresh = useCallback(() => {
    try {
      setRecords(loadRecords(false));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '本機資料操作失敗。');
    }
  }, []);

  const save = useCallback(
    (input: HealthRecordInput, id?: string) => {
      try {
        if (id) updateRecord(id, input);
        else saveRecord(input);
        refresh();
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '儲存失敗。');
        return false;
      }
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      deleteRecord(id);
      refresh();
    },
    [refresh]
  );

  const clear = useCallback(() => {
    clearAllRecords();
    setRecords([]);
    setError(null);
  }, []);

  const importJson = useCallback((json: string) => {
    const result = importRecords(json);
    if (result.records.length) setRecords(result.records);
    setError(result.errors.length ? result.errors.join(' ') : null);
    return result;
  }, []);

  return { records, error, setError, save, remove, clear, importJson };
}

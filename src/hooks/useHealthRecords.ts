import { useState } from 'react';
import type { DailyHealthRecord } from '../models/health';
import { loadRecords } from '../services/storage';

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
  return { records: initialState.records, error: initialState.error };
}

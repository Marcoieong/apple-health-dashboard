import { useMemo } from 'react';
import { createDemoRecords } from '../data/demoRecords';

export function useHealthRecords() {
  // This is the single read-only handoff point for ChatGPT-managed data.
  // Keep Demo records until a private import path for real health data is approved.
  const records = useMemo(() => createDemoRecords(), []);
  return { records };
}

import { useMemo } from 'react';
import { createDemoMealEntries } from '../data/demoMealEntries';

export function useFoodJournal() {
  // This is the read-only handoff point for future approved meal metadata.
  // Demo entries intentionally contain placeholders instead of private photo URLs.
  const entries = useMemo(() => createDemoMealEntries(), []);

  return {
    entries,
    isReadOnly: true as const
  };
}

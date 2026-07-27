import { useEffect, useMemo, useState } from 'react';
import { AppShell, type AppView } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { DataEntry } from './features/data-entry/DataEntry';
import { DailyDashboard } from './features/daily-dashboard/DailyDashboard';
import { MonthlyProgress } from './features/monthly-progress/MonthlyProgress';
import { WeeklyTrends } from './features/weekly-trends/WeeklyTrends';
import { useHealthRecords } from './hooks/useHealthRecords';
import { todayKey } from './lib/date';
import { calculateWeeklySummary } from './lib/summaries';

const THEME_KEY = 'personal-health-dashboard:theme';

export default function App() {
  const { records, error, setError, save, remove, clear, importJson } = useHealthRecords();
  const [view, setView] = useState<AppView>('today');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date)),
    [records]
  );
  const today = sorted.find((record) => record.date === todayKey()) ?? sorted.at(-1);
  const weekly = calculateWeeklySummary(sorted.slice(-7), sorted.slice(-14, -7));

  const navigate = (nextView: AppView) => {
    setView(nextView);
    if (nextView !== 'entry') setEditingId(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showEntry = (id?: string) => {
    setEditingId(id);
    setView('entry');
    window.scrollTo({ top: 0 });
  };

  let content;
  if (!records.length && view !== 'entry') {
    content = <EmptyState onAdd={() => showEntry()} />;
  } else if (view === 'today' && today) {
    content = (
      <DailyDashboard
        record={today}
        weeklyChange={weekly.scoreChange}
        onEdit={() => showEntry(today.id)}
      />
    );
  } else if (view === 'weekly') {
    content = <WeeklyTrends records={records} />;
  } else if (view === 'monthly') {
    content = <MonthlyProgress records={records} month={todayKey().slice(0, 7)} />;
  } else {
    content = (
      <DataEntry
        records={records}
        error={error}
        initialRecordId={editingId}
        onClearError={() => setError(null)}
        onSave={save}
        onDelete={remove}
        onClear={clear}
        onImport={importJson}
      />
    );
  }

  return (
    <AppShell
      currentView={view}
      darkMode={darkMode}
      hasDemoData={records.some((record) => record.source === 'demo')}
      onNavigate={navigate}
      onToggleTheme={() => setDarkMode((current) => !current)}
    >
      {content}
    </AppShell>
  );
}

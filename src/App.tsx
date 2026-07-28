import { useEffect, useMemo, useState } from 'react';
import { AppShell, type AppView } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { DailyDashboard } from './features/daily-dashboard/DailyDashboard';
import { FoodJournal } from './features/food-journal/FoodJournal';
import { MonthlyProgress } from './features/monthly-progress/MonthlyProgress';
import { WeeklyTrends } from './features/weekly-trends/WeeklyTrends';
import { useFoodJournal } from './hooks/useFoodJournal';
import { useHealthRecords } from './hooks/useHealthRecords';
import { todayKey } from './lib/date';
import { calculateWeeklySummary } from './lib/summaries';

const THEME_KEY = 'personal-health-dashboard:theme';

export default function App() {
  const { records } = useHealthRecords();
  const { entries: foodJournalEntries } = useFoodJournal();
  const [view, setView] = useState<AppView>('today');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let content;
  if (view === 'food-journal') {
    content = <FoodJournal entries={foodJournalEntries} />;
  } else if (!records.length) {
    content = <EmptyState />;
  } else if (view === 'today' && today) {
    content = <DailyDashboard record={today} weeklyChange={weekly.scoreChange} />;
  } else if (view === 'weekly') {
    content = <WeeklyTrends records={records} />;
  } else {
    content = <MonthlyProgress records={records} month={todayKey().slice(0, 7)} />;
  }

  return (
    <AppShell
      currentView={view}
      darkMode={darkMode}
      hasDemoData={
        records.some((record) => record.source === 'demo') ||
        foodJournalEntries.some((entry) => entry.source === 'demo')
      }
      onNavigate={navigate}
      onToggleTheme={() => setDarkMode((current) => !current)}
    >
      {content}
    </AppShell>
  );
}

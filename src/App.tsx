import { useEffect, useMemo, useState } from 'react';
import { AppShell, type AppView } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { HealthSyncStatus } from './components/HealthSyncStatus';
import { DailyDashboard } from './features/daily-dashboard/DailyDashboard';
import { FoodJournal } from './features/food-journal/FoodJournal';
import { MonthlyProgress } from './features/monthly-progress/MonthlyProgress';
import { WeeklyTrends } from './features/weekly-trends/WeeklyTrends';
import { useFoodJournal } from './hooks/useFoodJournal';
import { useHealthRecords } from './hooks/useHealthRecords';
import { usePrivateHealth } from './hooks/usePrivateHealth';
import { todayKey } from './lib/date';
import { calculateWeeklySummary } from './lib/summaries';

const THEME_KEY = 'personal-health-dashboard:theme';
const APP_VIEWS = new Set<AppView>(['today', 'weekly', 'monthly', 'food-journal']);

function initialView(): AppView {
  const requested = new URLSearchParams(window.location.search).get('section');
  return requested && APP_VIEWS.has(requested as AppView)
    ? (requested as AppView)
    : 'today';
}

export default function App() {
  const { records } = useHealthRecords();
  const foodJournal = useFoodJournal();
  const { entries: foodJournalEntries } = foodJournal;
  const isFamilyMember = foodJournal.status === 'authenticated';
  const privateHealth = usePrivateHealth(isFamilyMember);
  const activeRecords = isFamilyMember ? privateHealth.records : records;
  const [view, setView] = useState<AppView>(initialView);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const sorted = useMemo(
    () => [...activeRecords].sort((a, b) => a.date.localeCompare(b.date)),
    [activeRecords]
  );
  const today = sorted.find((record) => record.date === todayKey()) ?? sorted.at(-1);
  const weekly = calculateWeeklySummary(sorted.slice(-7), sorted.slice(-14, -7));

  const navigate = (nextView: AppView) => {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === 'today') url.searchParams.delete('section');
    else url.searchParams.set('section', nextView);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let content;
  if (view === 'food-journal') {
    content = (
      <FoodJournal
        entries={foodJournal.entries}
        mode={foodJournal.mode}
        status={foodJournal.status}
        member={foodJournal.member}
        error={foodJournal.error}
        login={foodJournal.login}
        logout={foodJournal.logout}
        retry={foodJournal.retry}
      />
    );
  } else if (isFamilyMember && privateHealth.status === 'loading') {
    content = null;
  } else if (!activeRecords.length) {
    content = <EmptyState />;
  } else if (view === 'today' && today) {
    content = <DailyDashboard record={today} weeklyChange={weekly.scoreChange} />;
  } else if (view === 'weekly') {
    content = <WeeklyTrends records={activeRecords} />;
  } else {
    content = <MonthlyProgress records={activeRecords} month={todayKey().slice(0, 7)} />;
  }

  return (
    <AppShell
      currentView={view}
      darkMode={darkMode}
      hasDemoData={
        !isFamilyMember &&
        (records.some((record) => record.source === 'demo') ||
          foodJournalEntries.some((entry) => entry.source === 'demo'))
      }
      onNavigate={navigate}
      onToggleTheme={() => setDarkMode((current) => !current)}
    >
      {view !== 'food-journal' && isFamilyMember ? (
        <div className="page-stack">
          <HealthSyncStatus
            status={privateHealth.status}
            syncStatus={privateHealth.syncStatus}
            error={privateHealth.error}
            onRetry={privateHealth.refresh}
          />
          {content}
        </div>
      ) : (
        content
      )}
    </AppShell>
  );
}

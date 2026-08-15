import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppShell, type AppView } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { HealthSyncStatus } from './components/HealthSyncStatus';
import { useFamilySession } from './hooks/useFamilySession';
import { useFoodJournal } from './hooks/useFoodJournal';
import { useFamilyBoard } from './hooks/useFamilyBoard';
import { useHealthRecords } from './hooks/useHealthRecords';
import { usePrivateHealth } from './hooks/usePrivateHealth';
import { todayKey } from './lib/date';
import { calculateWeeklySummary } from './lib/summaries';

const THEME_KEY = 'personal-health-dashboard:theme';
const APP_VIEWS = new Set<AppView>([
  'today',
  'weekly',
  'monthly',
  'food-journal',
  'family-board'
]);

const DailyDashboard = lazy(() =>
  import('./features/daily-dashboard/DailyDashboard').then((module) => ({
    default: module.DailyDashboard
  }))
);
const FoodJournal = lazy(() =>
  import('./features/food-journal/FoodJournal').then((module) => ({
    default: module.FoodJournal
  }))
);
const FamilyBoard = lazy(() =>
  import('./features/family-board/FamilyBoard').then((module) => ({
    default: module.FamilyBoard
  }))
);
const MonthlyProgress = lazy(() =>
  import('./features/monthly-progress/MonthlyProgress').then((module) => ({
    default: module.MonthlyProgress
  }))
);
const WeeklyTrends = lazy(() =>
  import('./features/weekly-trends/WeeklyTrends').then((module) => ({
    default: module.WeeklyTrends
  }))
);

function initialView(): AppView {
  const requested = new URLSearchParams(window.location.search).get('section');
  return requested && APP_VIEWS.has(requested as AppView)
    ? (requested as AppView)
    : 'today';
}

export default function App() {
  const { records } = useHealthRecords();
  const [view, setView] = useState<AppView>(initialView);
  const familySession = useFamilySession();
  const isFamilyMember = familySession.status === 'authenticated';
  const isFoodJournalView = view === 'food-journal';
  const isFamilyBoardView = view === 'family-board';
  const foodJournal = useFoodJournal(
    isFamilyMember && isFoodJournalView,
    familySession.refresh
  );
  const { entries: foodJournalEntries } = foodJournal;
  const familyBoard = useFamilyBoard(isFamilyMember && isFamilyBoardView);
  const privateHealth = usePrivateHealth(
    isFamilyMember && !isFoodJournalView && !isFamilyBoardView
  );
  const activeRecords = isFamilyMember ? privateHealth.records : records;
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
  if (view === 'family-board') {
    content = (
      <FamilyBoard
        sessionStatus={familySession.status}
        status={familyBoard.status}
        data={familyBoard.data}
        error={familySession.error ?? familyBoard.error}
        onLogin={() => familySession.login('family-board')}
        onRefresh={
          familySession.status === 'error'
            ? familySession.refresh
            : familyBoard.refresh
        }
      />
    );
  } else if (view === 'food-journal') {
    content = (
      <FoodJournal
        entries={foodJournal.entries}
        mode={foodJournal.mode}
        sessionStatus={familySession.status}
        loading={
          isFamilyMember &&
          (foodJournal.status === 'idle' || foodJournal.status === 'loading')
        }
        member={familySession.member}
        error={familySession.error ?? foodJournal.error}
        login={familySession.login}
        logout={familySession.logout}
        retry={
          familySession.status === 'error'
            ? familySession.refresh
            : foodJournal.refresh
        }
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

  const resolvedContent = (
    <Suspense
      fallback={
        <div className="empty-state" role="status" aria-live="polite">
          <p>正在載入頁面…</p>
        </div>
      }
    >
      {content}
    </Suspense>
  );

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
      {view !== 'food-journal' && view !== 'family-board' && isFamilyMember ? (
        <div className="page-stack">
          <HealthSyncStatus
            status={privateHealth.status}
            syncStatus={privateHealth.syncStatus}
            recordCount={sorted.length}
            rangeStart={sorted.at(0)?.date}
            rangeEnd={sorted.at(-1)?.date}
            error={privateHealth.error}
            onRetry={privateHealth.refresh}
          />
          {resolvedContent}
        </div>
      ) : (
        resolvedContent
      )}
    </AppShell>
  );
}

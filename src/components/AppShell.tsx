import {
  BarChart3,
  CalendarDays,
  HeartPulse,
  Moon,
  Sun
} from 'lucide-react';
import type { ReactNode } from 'react';

export type AppView = 'today' | 'weekly' | 'monthly';

const navigation: { id: AppView; label: string; icon: typeof HeartPulse }[] = [
  { id: 'today', label: '今日', icon: HeartPulse },
  { id: 'weekly', label: '每週', icon: BarChart3 },
  { id: 'monthly', label: '每月', icon: CalendarDays }
];

interface AppShellProps {
  children: ReactNode;
  currentView: AppView;
  darkMode: boolean;
  hasDemoData: boolean;
  onNavigate: (view: AppView) => void;
  onToggleTheme: () => void;
}

export function AppShell({
  children,
  currentView,
  darkMode,
  hasDemoData,
  onNavigate,
  onToggleTheme
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主要導覽">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <HeartPulse size={22} />
          </span>
          <div>
            <strong>健康節奏</strong>
            <small>Personal dashboard</small>
          </div>
        </div>
        <nav className="side-nav">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={currentView === id ? 'nav-button active' : 'nav-button'}
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
              aria-current={currentView === id ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="privacy-note">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>ChatGPT 匯入</strong>
            <span>Dashboard 只讀，沒有手動輸入</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">澳門 · ChatGPT 匯入</span>
            <h1>個人健康 Dashboard</h1>
          </div>
          <div className="topbar-actions">
            {hasDemoData && <span className="demo-pill">ChatGPT 匯入 · Demo</span>}
            <button
              className="icon-button"
              type="button"
              onClick={onToggleTheme}
              aria-label={darkMode ? '切換至淺色模式' : '切換至深色模式'}
              title={darkMode ? '淺色模式' : '深色模式'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="手機主要導覽">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            className={currentView === id ? 'active' : ''}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
            aria-current={currentView === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

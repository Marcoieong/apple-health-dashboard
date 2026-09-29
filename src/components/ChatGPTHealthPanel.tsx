import { ExternalLink, HeartHandshake, ShieldCheck } from 'lucide-react';
import type { AppView } from './AppShell';
import { ChatGPTAdviceImportPanel } from './ChatGPTAdviceImportPanel';

export const CHATGPT_HEALTH_URL = 'https://chatgpt.com/health/';

interface ChatGPTHealthPanelProps {
  view: AppView;
}

export function ChatGPTHealthPanel({ view }: ChatGPTHealthPanelProps) {
  const isFoodJournal = view === 'food-journal';

  return (
    <section
      className="wellness-insight-panel"
      aria-labelledby="chatgpt-health-panel-title"
    >
      <div className="wellness-insight-heading">
        <span className="wellness-insight-icon" aria-hidden="true">
          <HeartHandshake size={20} />
        </span>
        <div>
          <p className="eyebrow">ChatGPT Health 匯入建議</p>
          <h2 id="chatgpt-health-panel-title">個人分析與健康建議</h2>
        </div>
        <span className="quality-pill">
          <ShieldCheck size={14} aria-hidden="true" />
          權限分開
        </span>
      </div>

      <ChatGPTAdviceImportPanel />

      <details className="chatgpt-health-about">
        <summary>如何取得建議與資料來源</summary>

        <p className="wellness-insight-summary">
          {isFoodJournal
            ? '餐食照片會保存在私人 Dashboard。若要由 ChatGPT Health 分析，請在 ChatGPT Health 對話中提出；Dashboard 不會自動把照片傳送給 ChatGPT。'
            : 'ChatGPT Health 使用你在 ChatGPT 內授權的 Apple Health 資料提供私人分析；家庭 Dashboard 則顯示由 HealthBridge 同步的趨勢與家庭分享資料。'}
        </p>

        <div className="chatgpt-health-actions">
          <a
            className="chatgpt-health-link"
            href={CHATGPT_HEALTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="開啟官方 ChatGPT Health（在新分頁開啟）"
          >
            開啟 ChatGPT Health
            <ExternalLink size={17} aria-hidden="true" />
          </a>
          <span>官方 ChatGPT 服務 · 需在 ChatGPT 內另行授權</span>
        </div>

        <p className="chatgpt-health-hint">
          開啟後可在問題中加入 <strong>@Health</strong>，明確要求使用你在 ChatGPT Health 內連接的資料。
        </p>

        <div className="wellness-role-grid" aria-label="平台分工">
          <div>
            <strong>ChatGPT Health</strong>
            <span>個人分析與健康建議</span>
          </div>
          <div>
            <strong>家庭 Dashboard</strong>
            <span>同步狀態、趨勢、餐食及家庭互相督促</span>
          </div>
        </div>

        <footer className="wellness-insight-footer">
          <span>兩邊各自授權</span>
          <span>此處顯示已匯入的原文及整理重點；自動回寫尚未接通。</span>
        </footer>
      </details>
    </section>
  );
}

import { Bot } from 'lucide-react';

export function EmptyState() {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <span className="empty-icon" aria-hidden="true">
        <Bot size={30} />
      </span>
      <p className="eyebrow">只讀資料模式</p>
      <h2 id="empty-title">等待 ChatGPT 匯入資料</h2>
      <p>網站不提供手動輸入。資料由 ChatGPT 整理及驗證後匯入，今日、每週與每月分析會自動更新。</p>
    </section>
  );
}

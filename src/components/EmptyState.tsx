import { DatabaseZap } from 'lucide-react';

export function EmptyState() {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <span className="empty-icon" aria-hidden="true">
        <DatabaseZap size={30} />
      </span>
      <p className="eyebrow">同步狀態</p>
      <h2 id="empty-title">尚未有健康紀錄</h2>
      <p>健康紀錄將由私人 ChatGPT 流程導入；此網站不提供人工輸入。</p>
    </section>
  );
}

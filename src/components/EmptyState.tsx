import { ClipboardPlus } from 'lucide-react';

interface EmptyStateProps {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <span className="empty-icon" aria-hidden="true">
        <ClipboardPlus size={30} />
      </span>
      <p className="eyebrow">準備好由今天開始</p>
      <h2 id="empty-title">尚未有健康紀錄</h2>
      <p>你的資料只會留在這部裝置。新增第一筆紀錄後，今日、每週與每月分析會自動出現。</p>
      <button className="primary-button" type="button" onClick={onAdd}>
        新增今日紀錄
      </button>
    </section>
  );
}

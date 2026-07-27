import { Plus } from 'lucide-react';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <span className="empty-icon" aria-hidden="true">
        <Plus size={30} />
      </span>
      <p className="eyebrow">本機資料</p>
      <h2 id="empty-title">尚未有健康紀錄</h2>
      <p>新增第一筆紀錄，或在數據輸入頁匯入由 ChatGPT 整理的 JSON 備份。</p>
      <button className="primary-button" type="button" onClick={onAdd}>
        <Plus size={18} /> 新增第一筆紀錄
      </button>
    </section>
  );
}

import { useState, type FormEvent } from 'react';
import { ClipboardPaste, LoaderCircle, Trash2 } from 'lucide-react';
import { useImportedHealthAdvice } from '../hooks/useImportedHealthAdvice';
import { summarizeImportedHealthAdvice } from '../lib/importedHealthAdviceSummary';
import type { ImportedHealthAdvice } from '../models/importedHealthAdvice';

function formatImportedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-Hant-MO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Macau'
  }).format(date);
}

interface AdviceCardProps {
  item: ImportedHealthAdvice;
  latest?: boolean;
  onRemove: (id: string) => void;
}

function AdviceCard({ item, latest = false, onRemove }: AdviceCardProps) {
  const organised = summarizeImportedHealthAdvice(item.content);

  return (
    <article className={latest ? 'is-latest' : undefined}>
      <div className="chatgpt-advice-meta">
        <strong>
          {latest ? <span className="chatgpt-advice-latest-label">最新建議</span> : null}
          <span>
            {item.source === 'chatgpt_health_shortcut'
              ? '由 iPhone 分享捷徑匯入'
              : '由你手動匯入'}
          </span>
        </strong>
        <time dateTime={item.createdAt}>{formatImportedAt(item.createdAt)}</time>
      </div>

      <div className="chatgpt-advice-organised">
        <span>Dashboard 自動整理</span>
        {organised.summary.length ? (
          <section>
            <h4>重點摘要</h4>
            <ul>{organised.summary.map((line) => <li key={line}>{line}</li>)}</ul>
          </section>
        ) : null}
        {organised.actions.length ? (
          <section>
            <h4>今天可做</h4>
            <ol>{organised.actions.map((line) => <li key={line}>{line}</li>)}</ol>
          </section>
        ) : null}
        {organised.cautions.length ? (
          <section>
            <h4>注意事項</h4>
            <ul>{organised.cautions.map((line) => <li key={line}>{line}</li>)}</ul>
          </section>
        ) : null}
      </div>

      <details className="chatgpt-advice-original">
        <summary>查看 ChatGPT Health 原文</summary>
        <p>{item.content}</p>
      </details>

      <button
        className="text-button danger"
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`刪除 ${formatImportedAt(item.createdAt)} 匯入的建議`}
      >
        <Trash2 size={15} aria-hidden="true" />
        刪除
      </button>
    </article>
  );
}

export function ChatGPTAdviceImportPanel() {
  const [content, setContent] = useState('');
  const { advice, status, error, load, save, remove } =
    useImportedHealthAdvice(true);
  const pending = status === 'saving';
  const sortedAdvice = [...advice].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
  const [latestAdvice, ...olderAdvice] = sortedAdvice;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = content.trim();
    if (!normalized || pending) return;
    if (await save(normalized)) setContent('');
  };

  return (
    <div className="chatgpt-advice-import" aria-labelledby="chatgpt-advice-import-title">
      <div className="chatgpt-advice-import-heading">
        <ClipboardPaste size={19} aria-hidden="true" />
        <div>
          <h3 id="chatgpt-advice-import-title">ChatGPT Health 建議收件箱</h3>
          <p>先顯示最新建議的重點與行動；原文及歷史記錄可按需要展開。</p>
        </div>
      </div>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>重試</button>
        </div>
      ) : null}

      {status === 'loading' ? (
        <p className="chatgpt-advice-loading" role="status">正在載入已儲存建議…</p>
      ) : latestAdvice ? (
        <div className="chatgpt-advice-list" aria-label="已匯入的 ChatGPT Health 建議">
          <AdviceCard item={latestAdvice} latest onRemove={(id) => void remove(id)} />

          {olderAdvice.length ? (
            <details className="chatgpt-advice-history">
              <summary>過往建議（{olderAdvice.length}）</summary>
              <div>
                {olderAdvice.map((item) => (
                  <AdviceCard key={item.id} item={item} onRemove={(id) => void remove(id)} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : status === 'ready' ? (
        <p className="chatgpt-advice-empty">尚未匯入建議；健康數據仍可在上方正常查看。</p>
      ) : null}

      <details className="chatgpt-advice-manual">
        <summary>匯入 ChatGPT Health 建議</summary>
        <form onSubmit={submit}>
          <label htmlFor="chatgpt-health-advice">把官方 ChatGPT Health 的回覆貼在這裡</label>
          <textarea
            id="chatgpt-health-advice"
            value={content}
            maxLength={4000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="在 ChatGPT Health 複製建議，然後貼到這裡…"
          />
          <div className="chatgpt-advice-import-controls">
            <small>{content.length}/4000</small>
            <button className="primary-button" type="submit" disabled={!content.trim() || pending}>
              {pending ? <LoaderCircle className="sync-spinner" size={16} aria-hidden="true" /> : null}
              {pending ? '正在儲存…' : '儲存到私人 Dashboard'}
            </button>
          </div>
        </form>
      </details>

      <details className="chatgpt-advice-notes">
        <summary>匯入與私隱說明</summary>
        <p className="chatgpt-advice-disclosure">
          匯入後的原文會儲存在你的私人帳戶，重新開啟 Dashboard 時可再次查看，不與家庭成員分享。不使用 API Key，也不會產生 API 費用。目前尚未接通 ChatGPT Health 自動傳送建議。
          網站只會從原文抽取和排列重點，不會加入新的醫療判斷；如摘要與原意有差異，請以展開後的 ChatGPT Health 原文為準。
        </p>
      </details>
    </div>
  );
}

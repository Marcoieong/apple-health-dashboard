import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHATGPT_HEALTH_URL, ChatGPTHealthPanel } from './ChatGPTHealthPanel';

describe('ChatGPT Health role panel', () => {
  it('清楚區分官方 ChatGPT Health 與家庭 Dashboard', () => {
    const markup = renderToStaticMarkup(<ChatGPTHealthPanel view="today" />);

    expect(markup).toContain('官方 ChatGPT Health');
    expect(markup).toContain('個人分析與健康建議');
    expect(markup).toContain('ChatGPT Health 建議收件箱');
    expect(markup).toContain('匯入 ChatGPT Health 建議');
    expect(markup).toContain('不使用 API Key，也不會產生 API 費用');
    expect(markup).toContain('自動回寫尚未接通');
    expect(markup).not.toContain('Codex 本機分析');
  });

  it('提供可辨識的官方 ChatGPT Health 入口', () => {
    const markup = renderToStaticMarkup(<ChatGPTHealthPanel view="today" />);

    expect(markup).toContain('開啟 ChatGPT Health');
    expect(markup).toContain(`href="${CHATGPT_HEALTH_URL}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('@Health');
    expect(markup).toContain('需在 ChatGPT 內另行授權');
  });

  it('不聲稱餐食照片會自動送到 ChatGPT Health', () => {
    const markup = renderToStaticMarkup(<ChatGPTHealthPanel view="food-journal" />);

    expect(markup).toContain('Dashboard 不會自動把照片傳送給 ChatGPT');
    expect(markup).toContain('請在 ChatGPT Health 對話中提出');
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdviceImportPanel } from './ChatGPTAdviceImportPanel';

const importedAdvice = {
  id: 'd52ca744-f4bd-4b0e-94f8-5e35b7114d6a',
  source: 'chatgpt_health_manual',
  content: '今晚提早三十分鐘睡眠。',
  createdAt: '2026-08-26T12:00:00.000Z'
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatGPTAdviceImportPanel', () => {
  it('loads an empty private list and saves manually pasted advice', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ advice: [] }))
      .mockResolvedValueOnce(jsonResponse({ advice: [importedAdvice] }, 201));
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatGPTAdviceImportPanel />);

    expect(await screen.findByText(/尚未匯入建議/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('匯入 ChatGPT Health 建議'));

    fireEvent.change(
      screen.getByLabelText('把官方 ChatGPT Health 的回覆貼在這裡'),
      { target: { value: importedAdvice.content } }
    );
    fireEvent.click(screen.getByRole('button', { name: '儲存到私人 Dashboard' }));

    expect((await screen.findAllByText(importedAdvice.content)).length).toBeGreaterThan(0);
    expect(screen.getByText('由你手動匯入')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/private/chatgpt-health-advice',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ content: importedAdvice.content })
      })
    );
    expect(screen.getByLabelText('把官方 ChatGPT Health 的回覆貼在這裡')).toHaveValue('');
  });

  it('deletes only the selected imported advice through the private route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ advice: [importedAdvice] }))
      .mockResolvedValueOnce(jsonResponse({ deleted: true }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatGPTAdviceImportPanel />);

    expect((await screen.findAllByText(importedAdvice.content)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /刪除 .* 匯入的建議/ }));

    await waitFor(() => {
      expect(screen.queryAllByText(importedAdvice.content)).toHaveLength(0);
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/private/chatgpt-health-advice',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ id: importedAdvice.id })
      })
    );
  });

  it('labels advice received from the iPhone sharing Shortcut', async () => {
    const shortcutAdvice = {
      ...importedAdvice,
      source: 'chatgpt_health_shortcut',
      capturedAt: '2026-08-27T00:30:00.000Z'
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ advice: [shortcutAdvice] }))
    );

    render(<ChatGPTAdviceImportPanel />);

    expect((await screen.findAllByText(shortcutAdvice.content)).length).toBeGreaterThan(0);
    expect(screen.getByText('由 iPhone 分享捷徑匯入')).toBeInTheDocument();
  });

  it('organises imported advice while keeping the original available for review', async () => {
    const structuredAdvice = {
      ...importedAdvice,
      content: [
        '重點：昨天睡眠不足七小時。',
        '今天可做：今晚提早三十分鐘休息。',
        '注意事項：若持續不適，應諮詢醫療專業人員。'
      ].join('\n')
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ advice: [structuredAdvice] }))
    );

    render(<ChatGPTAdviceImportPanel />);

    expect(await screen.findByText('Dashboard 自動整理')).toBeInTheDocument();
    expect(screen.getByText('重點摘要')).toBeInTheDocument();
    expect(screen.getByText('昨天睡眠不足七小時。')).toBeInTheDocument();
    expect(screen.getByText('今天可做')).toBeInTheDocument();
    expect(screen.getByText('今晚提早三十分鐘休息。')).toBeInTheDocument();
    expect(screen.getByText('注意事項')).toBeInTheDocument();
    expect(screen.getByText('若持續不適，應諮詢醫療專業人員。')).toBeInTheDocument();
    expect(screen.getByText('查看 ChatGPT Health 原文')).toBeInTheDocument();
  });
});

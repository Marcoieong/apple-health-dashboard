# ChatGPT 接入沿革與目前卡點

核對日期：2026-09-29（Asia/Macau）。

## 三條不同路徑

1. **自訂唯讀 MCP**：`/mcp` 經 OAuth 提供 `get_health_summary` 和 `get_health_sync_status`，使用 health.read。本輪同步狀態呼叫成功。這是 Dashboard 自訂 connector，不是官方 ChatGPT Health。
2. **手動貼回答案**：本機有把使用者選取的 ChatGPT Health 回答存為建議的程式；相關修改尚未全部提交或部署。
3. **捷徑與 Mac 收件箱**：使用者把回答儲存到 iCloud Shortcuts 的 HealthDashboardInbox/Marco/Inbox，Mac Worker 再向 `/api/shortcut/chatgpt-health-advice` 上傳。這仍包含使用者選取／儲存回答的步驟。

## 本輪證據

- Mac 收件箱排程已註冊，間隔 43,200 秒（12 小時），憑證存在；未公開憑證內容。
- 收件箱目前為空，歷史 Processed 與 Errors 均有檔案。這些檔案數量不能證明目前正式端點成功接收。
- 正式建議匯入路由 GET 與無憑證空 POST 均為 404。需要先完成隔離預覽的匯入 API 與頁面驗證，才能接回正式流程。
- 本機說明聲稱拒收 HTML，但目前 Worker 會抽取 HTML，包含選最長嵌入文字的邏輯；可能取錯回答。尚未完成修正與端到端驗證，不應當作可靠的官方回答匯出。

## 免貼上的自動分析方案

可由伺服器讀取最小必要健康摘要，排程呼叫 OpenAI API，驗證結構化結果後存入建議資料表，由 Dashboard 顯示。這是自訂 API 分析服務，使用獨立 API 計費，不是官方 ChatGPT Health；目前尚未實作或驗證。

官方說明提供 Apple Health 連入 ChatGPT 的功能，但本輪未找到可供私人網站定時取得官方 Health 回答並自動回寫的公開 API。不能把目前的唯讀 MCP、Mac 排程或 Codex Worker 當作這項能力已完成的證據。

採用 API 方案前需確定健康摘要傳送範圍、頻率與費用；之後以同一筆資料驗證排程、模型回應、儲存、去重及畫面顯示。現有手動收件箱不宜再擴展為主要自動架構。

官方來源：https://help.openai.com/en/articles/20001036-health-in-chatgpt

# 個人健康 Dashboard

一個以澳門日常生活與 iPhone Safari 為優先的個人健康習慣 Dashboard。健康紀錄可在網站手動新增、編輯、刪除，亦可匯入由 ChatGPT 整理的 JSON；網站負責計算每日 100 分健康分數，並顯示每日、每週、每月摘要及飲食照片日誌。

> 本工具只用於健康習慣追蹤，不提供醫療診斷或治療建議。現階段沒有直接連接 Apple Health；首次開啟的 14 日資料是虛構示例，清楚標示為 **Demo Data · 非真實資料**。

## 功能

- 今日總覽：分數、評級、各項進度、差距與一項可執行補救建議
- 每週趨勢：最近 7 日圖表、平均、上週比較、瓶頸與習慣完成率
- 每月進度：體重、體脂、腰圍、活動、睡眠、訓練及月度優先任務
- 飲食日誌：按澳門日期與餐別展示食物照片及種類，不估算卡路里或份量
- 本機資料管理：新增、編輯、刪除、清除，重新整理後仍會保留
- 備份與移轉：JSON／CSV 匯出、JSON 驗證匯入
- ChatGPT 匯入：ChatGPT 可按既定 schema 整理資料，再由使用者主動匯入
- 手機優先：iPhone Safe Area、底部導覽、大觸控區、深色模式
- 基礎 PWA：manifest、service worker、standalone 顯示與離線開啟已建置內容

## 技術架構

- React 19、TypeScript、Vite
- Recharts
- 可維護的全域設計 tokens 與 feature-based CSS class
- Vitest 單元測試
- Playwright Chromium 端到端與響應式測試
- Vite PWA plugin

主要模組位於 `src/features`、`src/lib`、`src/models` 及 `src/services`。評分是純函數，本機儲存與匯入／匯出集中在 service，React 元件不直接操作 `localStorage`。

## 安裝與啟動

需要 Node.js 20 或以上。專案鎖定使用 pnpm：

```bash
corepack enable
pnpm install
pnpm dev
```

開啟終端顯示的本機網址（一般為 `http://localhost:5173`）。

如環境只提供 npm，也可使用：

```bash
npm install
npm run dev
```

## 測試與 Build

```bash
pnpm lint
pnpm test
pnpm build
pnpm privacy:scan
pnpm test:e2e
pnpm preview
```

首次執行端到端測試前：

```bash
pnpm exec playwright install chromium
```

生產檔案會輸出至 `dist/`。

## iPhone 使用

1. 將已部署網址以 Safari 開啟。
2. 點「分享」。
3. 選「加入主畫面」。
4. 從主畫面開啟即可使用 standalone 顯示。

網站首次開啟會載入 14 日虛構健康資料及虛構飲食日誌。底部導覽有「今日」、「每週」、「每月」、「飲食日誌」和「輸入」。所有健康輸入均留在當前 Safari 網站的本機儲存空間。

## 資料儲存、清除與備份

- 儲存位置：瀏覽器 origin 專屬的 `localStorage`，schema key 為 `personal-health-dashboard.records`。
- 清除：進入「輸入」頁底部，選「清除全部」並確認。
- 備份：在「輸入」頁選「匯出 JSON」；CSV 適合試算表查看，但 JSON 才是完整還原格式。
- 還原：選「匯入 JSON」。無效格式會被拒絕；重複日期會略過，不覆寫現有紀錄。
- ChatGPT 流程：把結構化資料交給 ChatGPT 整理日期、澳門時區、單位、缺失值及重複紀錄，再由使用者在自己的裝置主動匯入 JSON。
- 每天的食物照片以手機 ChatGPT 作主要入口；專用私人 MCP tool 取得照片後，才寫入私人服務。
- Codex 負責建立、測試及維護這套服務，不是日常拍照上傳入口。
- 公開 GitHub Pages 不會在未確認私隱方案前放入真實個人健康資料。

目前飲食照片部分只完成資料 contract、處理核心、資料庫 schema、唯讀展示與測試框架；尚未部署 OAuth、私人物件儲存或可供 ChatGPT 連接的正式 MCP endpoint。詳細設計見 [食物照片架構](docs/FOOD_PHOTO_ARCHITECTURE.md)、[資料處理說明](docs/DATA_HANDLING.md) 與 [隱私說明](docs/PRIVACY.md)。

## 部署

GitHub Pages workflow 與 Cloudflare Pages 設定已備妥，詳見 [部署指南](docs/DEPLOYMENT.md)。本階段推薦 Cloudflare Pages，因為 Vite SPA 的根路徑設定較直接；若 GitHub 已是主要程式碼平台，也可直接使用已提供的 Actions workflow。

## 已知限制

- 未直接連接 Apple Health／HealthKit
- `localStorage` 不會跨裝置同步，清除 Safari 網站資料也會刪除紀錄
- 沒有自動雲端備份；需手動匯出 JSON
- 尚未部署可承載真實健康及照片資料的登入、私人後端與 ChatGPT MCP 連線
- 沒有 AI 自動分析
- PWA 離線只保證已快取介面可開啟；私人 `/api/` 資料明確不進 service worker cache
- 月度比較只依賴已匯入紀錄；缺失欄位會以「—」顯示

## 第二階段

下一階段先用 iOS Shortcut 產生受控 JSON，加入匯入預覽與差異確認；完成 2–4 週實際使用驗證後，再考慮 HealthKit companion app。方案比較見 [Apple Health 整合計劃](docs/APPLE_HEALTH_INTEGRATION_PLAN.md)。

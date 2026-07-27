# 個人健康 Dashboard

一個以澳門日常生活與 iPhone Safari 為優先的個人健康習慣 Dashboard。介面採只讀模式：健康資料由 ChatGPT 整理及驗證後匯入，網站負責計算每日 100 分健康分數，並顯示每日、每週及每月摘要。

> 本工具只用於健康習慣追蹤，不提供醫療診斷或治療建議。現階段沒有直接連接 Apple Health；公開網站的初始 14 日資料是虛構示例，清楚標示為 **ChatGPT 匯入 · Demo**。

## 功能

- 今日總覽：分數、評級、各項進度、差距與一項可執行補救建議
- 每週趨勢：最近 7 日圖表、平均、上週比較、瓶頸與習慣完成率
- 每月進度：體重、體脂、腰圍、活動、睡眠、訓練及月度優先任務
- 只讀資料：沒有新增、編輯、刪除或檔案上載入口
- ChatGPT 管理：由 ChatGPT 完成資料整理、驗證及版本更新
- 手機優先：iPhone Safe Area、底部導覽、大觸控區、深色模式
- 基礎 PWA：manifest、service worker、standalone 顯示與離線開啟已建置內容

## 技術架構

- React 19、TypeScript、Vite
- Recharts
- 可維護的全域設計 tokens 與 feature-based CSS class
- Vitest 單元測試
- Playwright Chromium 端到端與響應式測試
- Vite PWA plugin

主要模組位於 `src/features`、`src/lib`、`src/models` 及 `src/services`，React 元件不直接承擔評分或儲存邏輯。

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
pnpm test:e2e
pnpm build
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

網站目前會載入 14 日虛構 Demo Data。底部導覽只有「今日」、「每週」和「每月」，不提供輸入或編輯頁。

## ChatGPT 資料流程

- 使用者把 Apple 健康匯出或結構化紀錄交給 ChatGPT。
- ChatGPT 整理日期、澳門時區、單位、缺失值及重複紀錄。
- 通過資料驗證及私隱檢查後，才更新 Dashboard 的只讀資料來源。
- 公開 GitHub Pages 不會在未確認私隱方案前放入真實個人健康資料。

健康匯出檔屬敏感個人資料，應存放在受保護的位置。詳細規則見 [資料處理說明](docs/DATA_HANDLING.md) 與 [隱私說明](docs/PRIVACY.md)。

## 部署

GitHub Pages workflow 與 Cloudflare Pages 設定已備妥，詳見 [部署指南](docs/DEPLOYMENT.md)。本階段推薦 Cloudflare Pages，因為 Vite SPA 的根路徑設定較直接；若 GitHub 已是主要程式碼平台，也可直接使用已提供的 Actions workflow。

## 已知限制

- 未直接連接 Apple Health／HealthKit
- 尚未建立可承載真實健康資料的登入及私人後端
- 沒有 AI 自動分析
- PWA 離線只保證已快取介面可開啟，不會進行背景健康資料同步
- 月度比較只依賴已匯入紀錄；缺失欄位會以「—」顯示

## 第二階段

下一階段先以可審核、私密的 ChatGPT 匯入流程驗證資料欄位、時區與重複資料處理，再考慮 HealthKit companion app。方案比較見 [Apple Health 整合計劃](docs/APPLE_HEALTH_INTEGRATION_PLAN.md)。

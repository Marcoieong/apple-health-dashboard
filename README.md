# 個人健康 Dashboard

一個以澳門日常生活與 iPhone Safari 為優先的個人健康習慣 Dashboard。公開網站採唯讀模式：不提供人工輸入、檔案上傳或資料修改。私人餐食紀錄由 iPhone Shortcut 經受保護 API 寫入；網站只有在當次頁面輸入存取碼後，才讀取私人餐食摘要。網站亦會計算每日 100 分健康分數，並顯示每日、每週及每月摘要。

> 本工具只用於健康習慣追蹤，不提供醫療診斷或治療建議。現階段沒有直接連接 Apple Health；首次開啟的 14 日資料是虛構示例，清楚標示為 **Demo Data · 非真實資料**。

## 功能

- 今日總覽：分數、評級、各項進度、差距與一項可執行補救建議
- 每週趨勢：最近 7 日圖表、平均、上週比較、瓶頸與習慣完成率
- 每月進度：體重、體脂、腰圍、活動、睡眠、訓練及月度優先任務
- 飲食日誌：按澳門日期與餐別展示食物照片及種類，不估算卡路里或份量
- 公開介面唯讀：不提供新增、編輯、刪除、檔案上傳或公開匯入
- 資料服務預留：JSON 驗證、儲存與匯出函數保留供日後受保護整合使用
- iPhone Shortcut 導入：Bearer 驗證、Base64 圖片上傳、EXIF/GPS 清除、重試去重及私人儲存
- 私人唯讀日誌：存取碼只留在當次 React 記憶體；重整、關閉頁面或按「鎖定」即清除
- ChatGPT 導入預留：MCP/OAuth 接口保留，但不宣稱 Pro 帳戶已支援手機自訂 MCP 寫入
- 手機優先：iPhone Safe Area、底部導覽、大觸控區、深色模式
- 基礎 PWA：manifest、service worker、standalone 顯示與離線開啟已建置內容

## 技術架構

- React 19、TypeScript、Vite
- Recharts
- 可維護的全域設計 tokens 與 feature-based CSS class
- Vitest 單元測試
- Playwright Chromium 端到端與響應式測試
- Vite PWA plugin

主要模組位於 `src/features`、`src/lib`、`src/models` 及 `src/services`。評分是純函數；預留的本機儲存與資料轉換集中在 service，React 元件不直接操作 `localStorage`。公開介面只讀取資料，不暴露修改控制。

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

網站首次開啟會載入 14 日虛構健康資料及虛構飲食日誌。底部導覽有「今日」、「每週」、「每月」和「飲食日誌」。公開版沒有人工輸入頁、編輯按鈕或檔案上傳。私人餐食的手機建立方法見 [iPhone Shortcut 設定指南](docs/IPHONE_SHORTCUT_SETUP.md)。

## 資料儲存與導入邊界

- 目前公開網站只載入虛構 Demo Data，不提供清除、備份、還原或匯入控制。
- 如需移除瀏覽器內的網站資料，可在 Safari 設定中清除該網站的資料。
- storage service 仍保留 schema 驗證、版本遷移及匯入／匯出能力，但不會暴露在公開 UI。
- 真實餐食資料只可經受 Bearer 存取碼保護的 iPhone Shortcut API 寫入；不能把一般 ChatGPT 附件視為已自動同步。
- Shortcut 直接送出壓縮後的 Base64 圖片，不傳外部圖片網址；伺服器會再次驗證格式並重新編碼以移除 EXIF/GPS。
- Dashboard 解鎖後只讀取餐食標籤、日期、餐別、備註與相片張數，不向公開頁載入私人相片。
- 公開部署不會在未確認私隱方案前放入真實個人健康資料。

目前飲食照片部分已完成資料 contract、Shortcut 寫入端點、私人資料庫、私人物件儲存、圖片清理、唯讀摘要端點及 Dashboard 解鎖介面。缺少秘密或私人儲存設定時，端點會 fail closed。操作見 [iPhone Shortcut 設定指南](docs/IPHONE_SHORTCUT_SETUP.md)；完整設計見 [食物照片架構](docs/FOOD_PHOTO_ARCHITECTURE.md)、[資料處理說明](docs/DATA_HANDLING.md) 與 [隱私說明](docs/PRIVACY.md)。

## 部署

目前選用 Vercel 連接 GitHub repository，並以 `health.pui-pui.org` 作正式網域。GitHub Pages workflow 與 Cloudflare Pages 設定仍保留作候選／後備，詳見 [部署指南](docs/DEPLOYMENT.md)。

## 已知限制

- 未直接連接 Apple Health／HealthKit
- 健康指標仍是 Demo Data；尚未由 Shortcut 或 Apple Health 自動同步
- 公開網站不提供人工輸入、匯入、匯出或自動雲端備份
- Shortcut 現階段只寫入餐食照片及餐食標籤；不是完整健康紀錄輸入
- 存取碼屬共享秘密；遺失或外洩時必須立即輪替
- ChatGPT 自訂 MCP 寫入仍未作為正式手機入口
- 沒有 AI 自動分析
- PWA 離線只保證已快取介面可開啟；私人 `/api/` 資料明確不進 service worker cache
- 月度比較只依賴可讀取的紀錄；缺失欄位會以「—」顯示

## 第二階段

下一階段只完成一件事：在 iPhone 實機建立 Shortcut，寫入一餐測試紀錄並確認 Dashboard 私人唯讀顯示、重試去重及鎖定行為。Apple Health 方案比較見 [Apple Health 整合計劃](docs/APPLE_HEALTH_INTEGRATION_PLAN.md)。

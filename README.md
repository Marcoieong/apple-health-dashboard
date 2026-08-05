# 個人健康 Dashboard

一個以澳門日常生活與 iPhone Safari 為優先的家庭健康習慣 Dashboard。公開部分只顯示 Demo Data；獲邀請的家庭成員可用自己的帳戶登入，各自查看私人餐食紀錄及受保護縮圖。網站不提供人工健康資料輸入，餐食由每位成員自己的 iPhone Shortcut 寫入。健康指標頁會計算每日 100 分健康分數，並顯示每日、每週及每月摘要。

> 本工具只用於健康習慣追蹤，不提供醫療診斷或治療建議。正式網站現階段仍未直接連接 Apple Health；首次開啟的 14 日資料是虛構示例，清楚標示為 **Demo Data · 非真實資料**。

## 功能

- 今日總覽：分數、評級、各項進度、差距與一項可執行補救建議
- 每週趨勢：最近 7 日圖表、平均、上週比較、瓶頸與習慣完成率
- 每月進度：體重、體脂、腰圍、活動、睡眠、訓練及月度優先任務
- 飲食日誌：按澳門日期與餐別展示食物照片及種類，不估算卡路里或份量
- 公開介面唯讀：不提供新增、編輯、刪除、檔案上傳或公開匯入
- 資料服務預留：JSON 驗證、儲存與匯出函數保留供日後受保護整合使用
- 家庭私人帳戶：Auth0 登入、加密 HttpOnly session、邀請電郵 allowlist
- 成員資料隔離：每個帳戶使用獨立擁有人 ID 與 PostgreSQL RLS；家庭管理員不會預設看到其他成員資料
- iPhone Shortcut 導入：每位成員可建立及撤銷自己的 Bearer 金鑰；Base64 圖片會清除 EXIF/GPS、重試去重並存入私人儲存
- 私人唯讀日誌：登入後只讀取該成員自己的餐食摘要與短效受保護縮圖
- HealthKit 同步後端（開發分支）：日級聚合 contract、每裝置憑證、PostgreSQL RLS、冪等寫入、私人讀取及同步狀態 API；尚未部署或連接真機
- ChatGPT 唯讀健康工具（開發分支）：OAuth `health.read` 可讀取日級摘要與同步狀態；按需讀取已保存資料，尚未更新正式 Connector
- 手機優先：iPhone Safe Area、底部導覽、大觸控區、深色模式
- 基礎 PWA：manifest、service worker、standalone 顯示與離線開啟已建置內容

## 技術架構

- React 19、TypeScript、Vite
- Recharts
- Vercel Functions、Auth0、PostgreSQL RLS（私人資料層）
- 可維護的全域設計 tokens 與 feature-based CSS class
- Vitest 單元測試
- Playwright Chromium 端到端與響應式測試
- Vite PWA plugin

主要模組位於 `src/features`、`src/lib`、`src/models` 及 `src/services`。評分是純函數；預留的本機儲存與資料轉換集中在 service，React 元件不直接操作 `localStorage`。公開介面只讀取資料，不暴露修改控制。完整資料流、更新時機及交付狀態見 [系統架構](docs/SYSTEM_ARCHITECTURE.md)。

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

網站首次開啟會載入 14 日虛構健康資料及虛構飲食日誌。底部導覽有「今日」、「每週」、「每月」和「飲食日誌」。公開版沒有人工輸入頁、編輯按鈕或檔案上傳。家庭成員登入及邀請方式見 [家庭帳戶指南](docs/FAMILY_ACCOUNTS.md)；手機餐食建立方法見 [iPhone Shortcut 設定指南](docs/IPHONE_SHORTCUT_SETUP.md)。

## 資料儲存與導入邊界

- 目前公開網站只載入虛構 Demo Data，不提供清除、備份、還原或匯入控制。
- 如需移除瀏覽器內的網站資料，可在 Safari 設定中清除該網站的資料。
- storage service 仍保留 schema 驗證、版本遷移及匯入／匯出能力，但不會暴露在公開 UI。
- 真實餐食資料只可經家庭成員自己的可撤銷 Bearer 金鑰，由 iPhone Shortcut API 寫入；不能把一般 ChatGPT 附件視為已自動同步。
- Shortcut 直接送出壓縮後的 Base64 圖片，不傳外部圖片網址；伺服器會再次驗證格式並重新編碼以移除 EXIF/GPS。
- Dashboard 登入後只讀取該成員的餐食標籤、日期、餐別、備註及短效受保護縮圖；圖片不使用公開 Blob URL。
- 公開部署不會在未確認私隱方案前放入真實個人健康資料。
- HealthKit 第二階段只接受已批准的日級聚合，不接受原始 samples 或逐分鐘時間線；缺失欄位不覆蓋既有值，`0` 則保留為有效觀測。
- ChatGPT 只在工具被呼叫時讀取資料庫內最新摘要，不會直接讀 HealthKit，也不是排程同步服務。

目前飲食照片部分已完成資料 contract、Shortcut 寫入端點、私人資料庫、私人物件儲存、圖片清理、家庭登入、成員隔離、唯讀摘要及受保護縮圖。缺少身份、秘密或私人儲存設定時，端點會 fail closed。操作見 [家庭帳戶指南](docs/FAMILY_ACCOUNTS.md) 與 [iPhone Shortcut 設定指南](docs/IPHONE_SHORTCUT_SETUP.md)；完整設計見 [食物照片架構](docs/FOOD_PHOTO_ARCHITECTURE.md)、[資料處理說明](docs/DATA_HANDLING.md) 與 [隱私說明](docs/PRIVACY.md)。

## 部署

目前選用 Vercel 連接 GitHub repository，並以 `health.pui-pui.org` 作正式網域。GitHub Pages workflow 與 Cloudflare Pages 設定仍保留作候選／後備，詳見 [部署指南](docs/DEPLOYMENT.md)。

## 已知限制

- 正式網站未直接連接 Apple Health／HealthKit
- 健康同步後端只在開發分支完成；尚未套用 Preview schema、建立 iOS HealthBridge 或完成真機保存證據
- 健康指標仍是 Demo Data；尚未由 Apple Health 自動同步
- 公開網站不提供人工輸入、匯入、匯出或自動雲端備份
- Shortcut 現階段只寫入餐食照片及餐食標籤；不是完整健康紀錄輸入
- 家庭邀請目前由部署 allowlist 管理，尚未提供管理員自助邀請頁
- 各成員可撤銷自己的 iPhone 金鑰，但餐食自助刪除及家庭資料匯出仍未完成
- ChatGPT 唯讀健康工具已在開發分支完成，但尚未部署 Preview、更新 Connector 或取得真實 Apple Health 閉環證據
- 沒有定時 AI 自動分析；ChatGPT 只在對話中獲授權呼叫時按需解讀
- PWA 離線只保證已快取介面可開啟；私人 `/api/` 資料明確不進 service worker cache
- 月度比較只依賴可讀取的紀錄；缺失欄位會以「—」顯示

## 下一個小階段

建立最小 iOS HealthBridge（Auth0 Native PKCE、HealthKit 唯讀授權及手動同步），然後在隔離的 Vercel Preview 套用 `health-sync-v1` schema，以一個新 iPhone 請求核對 API 收據、資料庫 row 與 Dashboard 顯示。確認完整閉環後才加入背景同步、提升至正式網域或邀請其他家庭成員。完整路線見 [Apple Health 整合計劃](docs/APPLE_HEALTH_INTEGRATION_PLAN.md)。

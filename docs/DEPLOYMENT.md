# 部署指南

## Build

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm privacy:scan
```

輸出目錄為 `dist/`。本專案沒有 URL 子路由，因此重新整理不依賴伺服器 SPA fallback；service worker 與 manifest 由 Vite PWA plugin 產生。

## Vercel（目前選用）

專案已連接 GitHub repository，Vercel 會為功能分支建立預覽部署。確認預覽後再發佈 production，正式自訂網域為 `health.pui-pui.org`。

1. Import GitHub repository。
2. Framework preset 選 `Vite`。
3. Build command：`pnpm build`
4. Output directory：`dist`
5. Node.js 版本：20 或以上。
6. 不設定 `VITE_BASE_PATH`，使用預設 `/`。
7. 在 Domains 加入 `health.pui-pui.org`。
8. DNS 只新增或更新 `health` 這個 host；不可改動 root、MX 或其他服務紀錄。

先用 preview URL 在 iPhone 實機確認，再把已驗證版本 promote 至 production。`vercel.json` 已把 `/mcp` 與 OAuth metadata 導向 Vercel Functions，並對所有私人路徑設定 `Cache-Control: private, no-store`。

目前公開版本只包含虛構 Demo Data。真實個人健康資料不得加入公開部署；需先建立認證與私人資料層。

## Cloudflare Pages（後備）

Cloudflare Pages 可作後備，Build command 為 `pnpm build`，output directory 為 `dist`。`public/_redirects` 已包含 SPA fallback。

## GitHub Pages

`.github/workflows/deploy-pages.yml` 已準備好。推送至 `main` 後，在 GitHub repo：

1. 開啟 Settings → Pages。
2. Source 選 GitHub Actions。
3. workflow 會把 `VITE_BASE_PATH` 設為 `/<repo-name>/` 後 build。
4. workflow 成功後，用 Pages 網址實機驗證。

若改用自訂網域，應把 `VITE_BASE_PATH` 改為 `/` 並重新 build。

## iPhone 加到主畫面

1. 使用 Safari 開啟正式 HTTPS 網址。
2. 點分享按鈕。
3. 選「加入主畫面」。
4. 確認名稱「每日健康」後加入。

基礎 PWA 可離線載入已快取的前端資源。它不會在背景同步 Apple Health。

## 私人食物照片服務

Vercel 版本包含 HTTPS MCP 接入層；GitHub Pages／Cloudflare Pages 後備只部署前端，不能承載此 serverless endpoint 或真實照片。MCP 接入層預設鎖定，手機 ChatGPT 上傳仍須配置 OAuth、PostgreSQL、私人 object storage 及安全圖片處理 adapters。

允許真實資料前最少要完成：

1. OAuth protected-resource metadata、唯讀 `health.read` 與寫入 `meal.write` scope。
2. owner mapping、row-level security 及跨帳戶負面測試。
3. 短效 URL 安全下載、magic-byte／解碼檢查、EXIF/GPS 移除及縮圖工作。
4. 私人儲存 lifecycle、30 日 master 刪除及使用者刪除流程。
5. `Cache-Control`、CORS、CSP、速率限制、審計與敏感 log redaction。
6. staging MCP 連接後，用真實手機 ChatGPT 驗證照片選取、tool invocation、重試去重及網站顯示。

環境變數、ChatGPT 連接方式及鎖定狀態檢查見 [ChatGPT 接入指南](CHATGPT_CONNECTION.md)。完整設計及未驗證假設見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## Apple Health 私人同步後端（第二階段）

`codex/health-sync-phase2` 分支已包含 `health-sync-v1` migration 及私人 API，但尚未套用至 Preview 或 Production。它需要：

- `DATABASE_URL`：啟用 TLS 的 PostgreSQL 連線；程式會拒絕 `sslmode=disable`；
- `HEALTH_SYNC_TOKEN_SECRET`：最少 32 字元，用於加密／驗證每裝置同步憑證；
- `HEALTH_SYNC_CURSOR_SECRET`：最少 32 字元，用於簽署不透明同步 cursor。

秘密只可放在 Vercel 對應環境的 encrypted environment variables，不得加入 `.env` 範例值、Git、前端 `VITE_*` 變數或 iPhone Shortcut 網址。Preview 與 Production 必須使用不同秘密及資料庫（或至少不同嚴格隔離的 schema／角色）。

在獲得明確確認、備份並核對目標資料庫後，才可對 Preview 執行：

```bash
pnpm db:private:apply
```

腳本會依序套用尚未記錄的私人 schema migration，包括 `health-sync-v1`；不可在本機測試時把 Production `DATABASE_URL` 暴露到 shell history 或 log。套用後先以非敏感測試帳戶驗證：未授權為 401、跨成員／跨裝置被拒、相同請求可安全重試、私人讀取只回傳本人紀錄。最後才使用 iPhone HealthBridge 傳送一個真實但最小的日級聚合，核對 API 收據、資料庫 row 與 Dashboard 顯示三者一致。

目前不應把此分支 promote 至 `health.pui-pui.org`，也不應宣稱有固定更新頻率。手動同步成功後才加入 HealthKit background delivery；實際背景執行時間由 iOS 決定。

ChatGPT Preview 另須把 `CHATGPT_MCP_OWNER_ID` 設為 Marco 現有的 owner ID，並與 `AUTH0_WEB_LEGACY_OWNER_ID`／過渡期 `SHORTCUT_OWNER_ID` 完全一致。未完成這項核對時 MCP 應保持鎖定；不可用另一套 HMAC 推導後假設資料會自動對上。部署前先閱讀 [系統架構](SYSTEM_ARCHITECTURE.md) 與 [ChatGPT 接入指南](CHATGPT_CONNECTION.md)。

## 上線前檢查

- HTTPS 正常
- `manifest.webmanifest` 與 service worker 可載入
- iPhone 393×852 及 430×932 無橫向溢出
- 主畫面 standalone 開啟
- 四個導覽頁為「今日／每週／每月／飲食日誌」
- 公開介面沒有新增、編輯、刪除、匯入、匯出或上傳控制
- 重整後 Demo Data 仍可正常載入
- 清楚顯示「Demo Data · 非真實資料」
- 沒有 analytics、廣告或真實健康資料進入 Git
- `/api/`、`/mcp` 及 `/.well-known/` 不被 PWA navigation fallback 或 runtime cache 接管
- Health sync Preview 已通過未授權、跨成員、跨裝置、重試及修正值負面測試
- 至少一個新 iPhone 請求具有 API 收據、已保存資料庫 row 及 Dashboard 顯示證據

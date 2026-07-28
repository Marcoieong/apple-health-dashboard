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

1. OAuth protected-resource metadata、`meal.write` 與 `meal.read` scope。
2. owner mapping、row-level security 及跨帳戶負面測試。
3. 短效 URL 安全下載、magic-byte／解碼檢查、EXIF/GPS 移除及縮圖工作。
4. 私人儲存 lifecycle、30 日 master 刪除及使用者刪除流程。
5. `Cache-Control`、CORS、CSP、速率限制、審計與敏感 log redaction。
6. staging MCP 連接後，用真實手機 ChatGPT 驗證照片選取、tool invocation、重試去重及網站顯示。

環境變數、ChatGPT 連接方式及鎖定狀態檢查見 [ChatGPT 接入指南](CHATGPT_CONNECTION.md)。完整設計及未驗證假設見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

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

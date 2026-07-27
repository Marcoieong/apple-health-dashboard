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

## Cloudflare Pages（推薦）

建議第一階段使用 Cloudflare Pages：根路徑設定簡單，preview deployment 易於先在 iPhone 測試，也不需為 repo 名稱調整 asset base。

1. 在 Cloudflare Pages 連接 GitHub repo。
2. Framework preset 選 `Vite`。
3. Build command：`pnpm build`
4. Build output directory：`dist`
5. Node.js 版本：20 或以上。
6. 不設定 `VITE_BASE_PATH`，使用預設 `/`。
7. 部署後以 iPhone Safari 測試五個頁面、健康紀錄 CRUD、重新整理持久化、深色模式與加入主畫面。

目前公開版本只包含虛構 Demo Data。真實個人健康資料不得加入公開部署；需先建立認證與私人資料層。

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

公開 Pages 只部署前端框架；不能承載真實照片。手機 ChatGPT 上傳需要另外部署 HTTPS MCP／API 服務、OAuth、PostgreSQL 及私人 object storage，並把 frontend 的資料 adapter 指向已認證 API。

部署私人服務前最少要完成：

1. OAuth protected-resource metadata、`meal.write` 與 `meal.read` scope。
2. owner mapping、row-level security 及跨帳戶負面測試。
3. 短效 URL 安全下載、magic-byte／解碼檢查、EXIF/GPS 移除及縮圖工作。
4. 私人儲存 lifecycle、30 日 master 刪除及使用者刪除流程。
5. `Cache-Control`、CORS、CSP、速率限制、審計與敏感 log redaction。
6. staging MCP 連接後，用真實手機 ChatGPT 驗證照片選取、tool invocation、重試去重及網站顯示。

完整設計及未驗證假設見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## 上線前檢查

- HTTPS 正常
- `manifest.webmanifest` 與 service worker 可載入
- iPhone 393×852 及 430×932 無橫向溢出
- 主畫面 standalone 開啟
- 五個導覽頁為「今日／每週／每月／飲食日誌／輸入」
- 可新增、編輯、刪除、匯入及匯出健康紀錄
- 重整後本機資料仍存在，清除後維持空狀態
- 清楚顯示「Demo Data · 非真實資料」
- 沒有 analytics、廣告或真實健康資料進入 Git
- `/api/`、`/mcp` 及 `/.well-known/` 不被 PWA navigation fallback 或 runtime cache 接管

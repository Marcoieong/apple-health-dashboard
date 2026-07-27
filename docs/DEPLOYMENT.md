# 部署指南

## Build

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
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
7. 部署後以 iPhone Safari 測試三個只讀頁面、深色模式與加入主畫面。

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

## 上線前檢查

- HTTPS 正常
- `manifest.webmanifest` 與 service worker 可載入
- iPhone 393×852 及 430×932 無橫向溢出
- 主畫面 standalone 開啟
- 沒有輸入欄、編輯、刪除或檔案上載入口
- 三個導覽頁為「今日／每週／每月」
- 清楚顯示「ChatGPT 匯入 · Demo」
- 沒有 analytics、廣告或真實健康資料進入 Git

# 資料處理說明

## 本機健康紀錄

Dashboard 支援手動新增、編輯、刪除及清除健康紀錄。資料由獨立 storage service 讀寫目前網站 origin 的 `localStorage`，React 元件不直接管理儲存格式。首次開啟會建立 14 日虛構 Demo Data；清除全部後不會自動重新加入。

## ChatGPT 匯入流程

1. 使用者把 Apple 健康匯出或結構化紀錄交給 ChatGPT。
2. ChatGPT 檢查日期、澳門時區、單位、數值範圍、缺失值及重複日期。
3. 資料通過驗證後，轉成符合 `DailyHealthRecord` 的 JSON。
4. 使用者在自己的 Dashboard「輸入」頁主動選取 JSON；無效資料不會覆寫原有紀錄。
5. 匯入時保留缺失欄位並略過重複日期。建議匯入前先匯出 JSON 備份。

## 匯出、版本與遷移

- JSON 包含 `schemaVersion`、匯出時間及完整紀錄，是主要備份格式。
- CSV 是方便檢視的平面格式，不包括 schema metadata。
- 當前 `schemaVersion` 是 1，storage service 已預留 migration 函數。
- 任何解析、驗證或容量錯誤都會在介面顯示，不把健康資料寫到 console。

## 手機食物照片流程

日常入口是手機 ChatGPT，而不是 Codex 或網站表單。專用私人 MCP tool 會在使用者授權後接收 ChatGPT 提供的短效照片參照，即時下載並驗證，移除 EXIF/GPS，建立私人 master 與縮圖，再把餐別及食物種類 metadata 寫入私人資料層。

- 不把短效下載 URL、原始 ChatGPT file ID、物件儲存 key 或內容 hash 回傳至對話或網站。
- 以使用者範圍的 idempotency key 及內容 hash 防止重試造成重複資料。
- 網站只透過已認證的同源 API 讀取縮圖／展示版本，不提供原圖或直連 object storage。
- 現有程式碼是可測試框架；正式手機流程要待 OAuth、私人儲存、HTTPS MCP endpoint 部署後才能使用。

完整 contract、schema、保留政策與實作階段見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## 公開網站限制

目前 `health.pui-pui.org` 由公開 GitHub Pages 提供。任何隨網站發布的 JSON 或 JavaScript 都可被訪客下載，因此只可包含虛構 Demo Data。真實個人健康資料不可提交至公開 repository 或發布分支。

在加入真實資料前，必須先採用有身份驗證的私人資料層，或其他經使用者確認的端對端私密方案。

`localStorage` 只在使用者的瀏覽器內，不會隨靜態網站 build 上傳到 GitHub Pages；但它不是加密保險箱，也不會跨裝置同步。網址參數不是身份驗證，亦不能令公開 Pages 適合保存私人照片。

## 缺失資料

- 欄位可留空；摘要與畫面以「—」表示缺失，不把缺失數值當成零。
- 評分只對已提供的評分類別計分，並列出缺失欄位。
- Demo Data 必須在介面明確標示，不得表示為真實 Apple Health 紀錄。

# 資料處理說明

## 本機健康紀錄

公開 Dashboard 採唯讀模式，不提供新增、編輯、刪除、清除、上傳或檔案匯入。獨立 storage service 與 schema migration 仍保留，供日後受保護的私人整合使用；React 元件不直接管理儲存格式。首次開啟會建立 14 日虛構 Demo Data。

## 私人 ChatGPT 導入目標流程

1. 使用者只在獲授權的私人 ChatGPT 流程提交結構化紀錄。
2. ChatGPT 檢查日期、澳門時區、單位、數值範圍、缺失值及重複日期。
3. 資料通過驗證後，轉成符合 `DailyHealthRecord` 的 JSON。
4. 有身份驗證的私人服務顯示預覽與差異，經確認後才寫入私人資料來源。
5. 網站在獲授權情況下只讀取資料。此流程目前尚未部署；公開版仍只展示 Demo Data。

## 匯出、版本與遷移

- JSON envelope、CSV 轉換與 schema migration 函數保留作內部能力，公開介面不提供相關控制。
- 當前 `schemaVersion` 是 1，storage service 已預留 migration 函數。
- 任何解析、驗證或容量錯誤都不得把健康資料寫到 console。

## 手機食物照片流程

日常入口是手機 ChatGPT，而不是 Codex 或網站表單。專用私人 MCP tool 會在使用者授權後接收 ChatGPT 提供的短效照片參照，即時下載並驗證，移除 EXIF/GPS，建立私人 master 與縮圖，再把餐別及食物種類 metadata 寫入私人資料層。

- 不把短效下載 URL、原始 ChatGPT file ID、物件儲存 key 或內容 hash 回傳至對話或網站。
- 以使用者範圍的 idempotency key 及內容 hash 防止重試造成重複資料。
- 網站只透過已認證的同源 API 讀取縮圖／展示版本，不提供原圖或直連 object storage。
- 現有程式碼是可測試框架；正式手機流程要待 OAuth、私人儲存、HTTPS MCP endpoint 部署後才能使用。

完整 contract、schema、保留政策與實作階段見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## 公開網站限制

目前 `health.pui-pui.org` 規劃由公開 Vercel 靜態部署提供。任何隨網站發布的 JSON 或 JavaScript 都可被訪客下載，因此只可包含虛構 Demo Data。真實個人健康資料不可提交至公開 repository 或發布分支。

在加入真實資料前，必須先採用有身份驗證的私人資料層，或其他經使用者確認的端對端私密方案。

`localStorage` 只在使用者的瀏覽器內，不會隨靜態網站 build 上傳到 Vercel；但它不是加密保險箱，也不會跨裝置同步。網址參數不是身份驗證，亦不能令公開網站適合保存私人照片。

## 缺失資料

- 欄位可留空；摘要與畫面以「—」表示缺失，不把缺失數值當成零。
- 評分只對已提供的評分類別計分，並列出缺失欄位。
- Demo Data 必須在介面明確標示，不得表示為真實 Apple Health 紀錄。

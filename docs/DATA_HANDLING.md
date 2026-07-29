# 資料處理說明

## 本機健康紀錄

公開 Dashboard 採唯讀模式，不提供新增、編輯、刪除、清除、上傳或檔案匯入。獨立 storage service 與 schema migration 仍保留，供日後受保護的私人整合使用；React 元件不直接管理儲存格式。首次開啟會建立 14 日虛構 Demo Data。

## 私人 iPhone Shortcut 餐食流程

1. iPhone Shortcut 選取 1–4 張照片，先轉成不保留 metadata 的 JPEG。
2. Shortcut 收集澳門日期、餐別、食物標籤、做法及可選備註。
3. 圖片以 Base64 直接傳至 `/api/shortcut/meal`；不使用外部照片網址。
4. API 先驗證 Bearer 存取碼，再檢查欄位、實際圖片 magic bytes、單張及總大小。
5. 圖片在伺服器重新編碼及去除 EXIF/GPS，寫入私人物件儲存；metadata 寫入按擁有人隔離的 PostgreSQL。
6. `client_request_id` 經 HMAC 處理，用於重試去重；相同圖片亦以內容 hash 去重。
7. Dashboard 只在當次頁面輸入存取碼後，從 `/api/private/meals` 讀取不含圖片的私人餐食摘要。

## 匯出、版本與遷移

- JSON envelope、CSV 轉換與 schema migration 函數保留作內部能力，公開介面不提供相關控制。
- 當前 `schemaVersion` 是 1，storage service 已預留 migration 函數。
- 任何解析、驗證或容量錯誤都不得把健康資料寫到 console。

## 手機食物照片流程

日常入口是 iPhone Shortcut，而不是 Codex、ChatGPT 附件或網站表單。Shortcut 直接傳送圖片內容；API 建立清理後的私人 master 與縮圖，再把餐別及食物種類 metadata 寫入私人資料層。

- 不接收或保存外部下載 URL；不把物件儲存 key、內容 hash、資料庫 ID 或存取碼回傳至網站。
- 以使用者範圍的 idempotency key 及內容 hash 防止重試造成重複資料。
- 網站只透過已認證的同源 API 讀取摘要，目前不提供原圖、縮圖或直連 object storage。
- 存取碼只存在 Dashboard 當次 React 記憶體，不使用瀏覽器持久儲存。
- 現有 MCP/OAuth 程式碼保留作未來候選，但不參與目前 Shortcut 路徑。

完整 contract、schema、保留政策與實作階段見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## 公開網站限制

`health.pui-pui.org` 由公開 Vercel 部署提供介面。任何隨網站發布的 JSON 或 JavaScript 都可被訪客下載，因此只可包含虛構 Demo Data。真實個人健康資料、存取碼及 Vercel 秘密不可提交至公開 repository 或發布分支。

Bearer 存取碼是目前的單一使用者驗證邊界，不應放在網址參數。私人 API 回應使用 `private, no-store`，service worker 明確不快取 `/api/`。這仍不是多用戶 OAuth；日後如擴展使用者範圍，必須改用每人獨立身份與撤銷機制。

## 缺失資料

- 欄位可留空；摘要與畫面以「—」表示缺失，不把缺失數值當成零。
- 評分只對已提供的評分類別計分，並列出缺失欄位。
- Demo Data 必須在介面明確標示，不得表示為真實 Apple Health 紀錄。

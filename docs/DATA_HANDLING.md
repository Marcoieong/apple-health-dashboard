# 資料處理說明

## 本機健康紀錄

公開 Dashboard 採唯讀模式，不提供新增、編輯、刪除、清除、上傳或檔案匯入。獨立 storage service 與 schema migration 仍保留，供日後受保護的私人整合使用；React 元件不直接管理儲存格式。首次開啟會建立 14 日虛構 Demo Data。

## 私人 iPhone Shortcut 餐食流程

1. iPhone Shortcut 選取 1–4 張照片，先轉成不保留 metadata 的 JPEG。
2. Shortcut 收集澳門日期、餐別、食物標籤、做法及可選備註。
3. 圖片以 Base64 直接傳至 `/api/shortcut/meal`；不使用外部照片網址。
4. API 先驗證該家庭成員可撤銷的 Bearer 上傳金鑰，再檢查欄位、實際圖片 magic bytes、單張及總大小。
5. 圖片在伺服器重新編碼及去除 EXIF/GPS，寫入私人物件儲存；metadata 寫入按擁有人隔離的 PostgreSQL。
6. `client_request_id` 經 HMAC 處理，用於重試去重；相同圖片亦以內容 hash 去重。
7. Dashboard 以加密 HttpOnly session 從 `/api/private/meals` 讀取該成員的私人餐食摘要；縮圖經短效、再次核對擁有人的 `/api/private/photo` 代理讀取。

## 私人 Apple Health 日級同步（第二階段）

目前分支已建立後端 contract，但尚未部署或連接真機。預定資料流是：獲使用者逐類型授權的 iOS Companion App 在裝置內將 HealthKit 資料彙總成每日數字，再以每成員、每裝置的可撤銷 Bearer 憑證傳送至 `/api/health-sync/v1/days`。

第一版只接受：

- 步數；
- 活動能量（kcal）；
- 運動分鐘；
- 睡眠時數；
- 體重（kg）；
- 體脂率（%）。

每個同步日必須包含嚴格 `YYYY-MM-DD` 本地日期、IANA 時區及帶 offset 的來源更新時間。未提供的 metric 代表「這次不更新」；數值 `0` 是有效觀測，不能與缺失混為一談；JSON `null` 不接受。較新的 HealthKit 聚合可用較低數值修正舊紀錄，較舊來源時間則不覆蓋較新資料。

不收集原始 HealthKit samples、sample UUID、逐分鐘時間線、來源 App 名稱、裝置序號、廣告識別碼或未列入 contract 的健康資料。資料庫以 Auth0 衍生的不透明 owner ID 分隔成員，四張健康同步資料表均強制 RLS。同步 token 只應保存於 iOS Keychain；伺服器只保存 token hash，日誌只記錄追蹤 ID、雜湊裝置識別、日數、狀態及耗時，不記錄健康數值。

相同 `sync_id` 與相同 payload digest 的重試會回傳原有結果；相同 `sync_id` 配上不同內容會拒絕並回傳衝突。這項設計只證明預期行為，仍須經 Preview migration、真實 iPhone 請求及資料庫保存收據才可稱為已接通。

## ChatGPT 私人唯讀健康流程

開發分支提供 OAuth `health.read` 工具，只讀取資料庫內該 owner 已保存的日級聚合及同步狀態。ChatGPT 不直接讀 HealthKit、不觸發同步、不取得裝置識別、owner ID、原始 samples 或資料庫 ID。缺失值保持缺失；數值 `0` 是有效觀測。工具只在對話中被呼叫時讀取，沒有定時 AI 更新。

Marco 過渡期的 `CHATGPT_MCP_OWNER_ID` 必須與家庭登入的 legacy owner 及現有 Shortcut owner 完全一致；未另設時可由伺服器依次沿用既有 `AUTH0_WEB_LEGACY_OWNER_ID` 或現行 `SHORTCUT_OWNER_ID`，但家庭成員不可共用。正式聲稱接通前，仍須以一個全新 iPhone 請求核對 API 收據、資料庫 row、Dashboard 與 ChatGPT 同日摘要。

## 匯出、版本與遷移

- JSON envelope、CSV 轉換與 schema migration 函數保留作內部能力，公開介面不提供相關控制。
- 當前 `schemaVersion` 是 1，storage service 已預留 migration 函數。
- 任何解析、驗證或容量錯誤都不得把健康資料寫到 console。

## 手機食物照片流程

日常入口是 iPhone Shortcut，而不是 Codex、ChatGPT 附件或網站表單。Shortcut 直接傳送圖片內容；API 建立清理後的私人 master 與縮圖，再把餐別及食物種類 metadata 寫入私人資料層。

- 不接收或保存外部下載 URL；不把物件儲存 key、內容 hash、資料庫 ID 或存取碼回傳至網站。
- 以使用者範圍的 idempotency key 及內容 hash 防止重試造成重複資料。
- 網站只透過已認證的同源 API 讀取摘要與受保護縮圖，不提供直連 object storage。
- Auth0 權杖及 Shortcut 金鑰不交給 React；網站登入只使用加密 HttpOnly session Cookie。
- MCP/OAuth 健康讀取是獨立候選路徑，不參與目前 Shortcut 餐食上傳，也不會令 ChatGPT 直接取得 HealthKit 權限。

完整 contract、schema、保留政策與實作階段見 [食物照片架構](FOOD_PHOTO_ARCHITECTURE.md)。

## 公開網站限制

`health.pui-pui.org` 由公開 Vercel 部署提供介面。任何隨網站發布的 JSON 或 JavaScript 都可被訪客下載，因此只可包含虛構 Demo Data。真實個人健康資料、存取碼及 Vercel 秘密不可提交至公開 repository 或發布分支。

家庭網站使用每人獨立 Auth0 身份、穩定不透明 owner ID 與 PostgreSQL RLS。Shortcut 使用每人獨立且可撤銷的 Bearer 金鑰，不應放在網址參數。私人 API 回應使用 `private, no-store`，service worker 明確不快取 `/api/`。管理員只控制邀請 allowlist，不會預設擁有跨成員讀取權限。

## 缺失資料

- 欄位可留空；摘要與畫面以「—」表示缺失，不把缺失數值當成零。
- 評分只對已提供的評分類別計分，並列出缺失欄位。
- Demo Data 必須在介面明確標示，不得表示為真實 Apple Health 紀錄。

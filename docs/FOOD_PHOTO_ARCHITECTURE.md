# 手機食物照片架構

## 已選定的日常入口

日常上傳使用 **手機版 ChatGPT**，Codex 只負責建置、測試、部署及維護。
現有飲食照片日誌與健康數值 Dashboard 均維持只讀，不要求使用者在 Codex 桌面版選相片，也不在公開網站提供照片上傳或健康數值輸入表單。

普通 ChatGPT 對話的附件不會自行同步到這個網站。正式流程需要把一個私人
`record_meal` MCP tool 連接到指定 ChatGPT，讓使用者在手機傳相片時授權它把
附件交給私人後端。

```text
手機 ChatGPT 相片
  -> 私人 record_meal tool
  -> OAuth 驗證
  -> 即時取回短效附件
  -> 格式、安全及重複檢查
  -> 移除 metadata 並產生圖片版本
  -> 私人資料庫及 object storage
  -> 經認證唯讀 API
  -> 飲食日誌頁
```

ChatGPT 手機版是否會在「只傳相片」時穩定自動選用工具，仍須在 staging
接通後以真實 iPhone 驗證。在通過實機驗收前，產品文案應提示使用者可加一句
「記錄這餐」，不能承諾完全零操作的自動同步。

## ChatGPT 工具合約

合約位於：

- `server/meal-photo-mcp/toolDescriptor.ts`
- `server/meal-photo-mcp/contracts.ts`
- `server/meal-photo-mcp/ingest.ts`

`record_meal` 接收一至四張頂層 `photos[]` 附件，以及：

- `client_request_id`
- `local_date`
- `timezone`
- `meal_type`: `breakfast | lunch | dinner | snack`
- `food_labels[]`
- `preparation_methods[]`
- 可選 `notes`

用途只限記錄食物種類及烹調方式，不估算重量或卡路里。附件物件遵循
ChatGPT file parameter 合約：`download_url`、`file_id`，以及可選
`mime_type`、`file_name`。

工具回應只包含餐食 ID、日期、餐別、圖片數量、重用數量及狀態。短效下載
URL、ChatGPT file ID、hash、owner ID 和 object key 一律不得回傳。

## 接收及 API 流程

1. 每次呼叫先驗證 OAuth token 及 `meal.write` scope，owner 由 token
   `(issuer, subject)` 映射，request body 不可指定 owner。
2. 驗證欄位、HTTPS URL、附件數量及長度；下載器另須阻擋 redirect 至
   loopback、private、link-local 位址及 DNS rebinding。
3. 在同一次工具呼叫內立即使用短效 `download_url`，不入庫、不記 log。
4. 限制每張 20 MB；以 magic bytes 及實際解碼確認 JPEG、PNG 或 WebP，
   不信任檔名或聲稱的 MIME。
5. 對來源 bytes 計算 SHA-256，只在同一 owner 內精確去重。
6. 立即修正方向、移除 EXIF/GPS/XMP/IPTC，重新編碼 sanitized master
   及 thumbnail；未清理的來源 bytes 不持久保存。
7. 以 transaction 建立 meal、photo 關聯及安全的回應 snapshot。
8. 網站以 `meal.read` scope 讀取餐食 DTO；圖片經同源認證 media route
   提供，不向瀏覽器揭露 object-storage URL。

已建立的 transport：

```http
POST /mcp
GET  /.well-known/oauth-protected-resource
GET  /api/v1/meals?from=&to=&meal_type=&cursor=
GET  /api/meals/{meal_id}/photos/{ordinal}/thumbnail
```

Vercel 部署提供 `/mcp`、protected-resource metadata 及只揭露布林 readiness
的 `/api/chatgpt-status`。未配置完整 OAuth 環境時 `/mcp` 回傳鎖定狀態；
配置 OAuth 後仍須通過 Bearer token 的 issuer、audience、signature、時間及
`meal.write` scope 驗證。私人 storage adapters 未接通時，
`record_meal` 只回傳安全的「尚未啟用」錯誤，不下載或保留照片。

## Metadata schema

參考 migration 位於 `server/meal-photo-mcp/schema.sql`：

| 資料表 | 用途 | 重要限制 |
|---|---|---|
| `meal_entries` | 日期、時區、餐別、食物種類、烹調方式、備註 | 所有查詢 owner-scoped |
| `media_assets` | sanitized master／縮圖私有 key、尺寸、MIME、來源 hash | `UNIQUE(owner_id, content_sha256)` |
| `meal_photos` | 餐食與圖片及顯示次序 | 每餐最多四張 |
| `ingest_requests` | HMAC 重試鍵、request digest、結果 snapshot | `UNIQUE(owner_id, idempotency_key_hash)` |
| `ingest_request_files` | 附件次序及 HMAC 化來源參考 | 不保存原始 file ID |

資料庫啟用 row-level security。公開 DTO 使用 allowlist，不能包含 owner、
來源附件識別、hash、object key、原檔名或影像 metadata。

## 日期與餐別

- `local_date` 是使用者所在地日期；`timezone` 預設 `Asia/Macau`。
- 餐別由 ChatGPT 根據使用者文字及本地時間整理；不確定時應在回覆要求
  使用者確認，不能由伺服器以 UTC 時間猜測。
- 網站先按 `localDate` 由新至舊分組，同日再按餐別及紀錄時間排列。
- 一張相片再次用於另一餐，只重用 private blob；仍建立新的餐食關聯，
  不因內容相同而合併兩餐。

## 去重與手機重試

- `client_request_id` 先經 server-secret HMAC 才入庫。
- request digest 由餐食 metadata 及按次序 HMAC 化的 file references
  產生，不包含短效 URL、檔名或 MIME。
- 同 owner、同 idempotency key、同 digest：回傳第一次結果，不再下載。
- 同 key、不同 digest：回傳 `idempotency_conflict`。
- 圖片下載後再以 owner-scoped SHA-256 精確去重；不跨帳戶共享身份或紀錄。
- perceptual hash 日後只可標示「疑似重複」，不能自動刪除。

## 圖片版本及保留

- 未清理原始 bytes：只在記憶體／受控暫存中存在，sanitization 完成即移除。
- sanitized master：長邊上限建議 1600 px，預設保留 30 日後刪除。
- thumbnail：長邊建議 320 px，保留至餐食或帳戶被刪除。
- object storage 必須是 private bucket、server-side encryption、隨機 key。
- 網站預設只讀 thumbnail。需要放大圖時由認證 API 即時授權；不提供原始
  附件下載。
- 餐食或帳戶刪除時，只有沒有其他 meal 關聯的 asset 才可被清除。

這個策略刻意不永久保留含 EXIF 的來源檔。如日後確實需要備份原始照片，
必須另作明確同意、加密、期限和刪除設計。

## 權限、私隱及快取

- ChatGPT 寫入 scope：`meal.write`；網站讀取 scope：`meal.read`。
- OAuth 驗證 issuer、audience、signature、expiry、not-before 及 scope。
- 網站建議使用 Secure、HttpOnly、SameSite cookie 的 BFF session。
- CORS 只允許正式網站 origin；JSON 回應使用
  `Cache-Control: private, no-store`。
- service worker 對 `/api/` 及私人圖片採 `NetworkOnly`，不能離線保存。
- `?version=readonly-chatgpt` 只是介面參數，不是身份驗證。
- 真實圖片、API response、附件 URL、對話 ID、裝置資料及 EXIF 不得進入
  Git、`dist/`、前端 bundle、`localStorage`、analytics 或 application log。

## Codex 分步實作

1. **已完成框架**：工具及 DTO contracts、接收核心、驗證／去重測試、資料庫
   schema、只讀飲食日誌頁、public-bundle 私隱掃描。
2. **已完成鎖定接入層**：MCP Streamable HTTP transport、OAuth
   protected-resource metadata、JWT／scope 驗證及 readiness endpoint。
3. **私人服務 adapters**：PostgreSQL transaction、私人 object storage、
   圖片 codec、SSRF-safe downloader及正式 OAuth 身份服務配置。
4. **唯讀接駁**：`meal.read` API、BFF session、縮圖 media route，將前端
   demo data adapter 換成認證 API adapter。
5. **Staging 驗收**：MCP Inspector contract test、權限及重試測試、iPhone
   ChatGPT 實機傳相片、網站跨日／餐別展示。
6. **Production**：設定 retention lifecycle、備份／刪除流程、監察失敗率，
   通過私隱掃描後才容許真實資料。

接入層存在不代表已配置 OAuth、資料庫、storage 或把工具安裝到 ChatGPT；
未完成第三至第五步前，真實相片不會離開 ChatGPT。具體配置及驗收命令見
[ChatGPT 接入指南](CHATGPT_CONNECTION.md)。

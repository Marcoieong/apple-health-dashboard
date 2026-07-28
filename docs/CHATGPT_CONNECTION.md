# ChatGPT 私人接入指南

## 現況

Vercel 版本提供標準 Streamable HTTP MCP endpoint：

```text
https://<deployment-domain>/mcp
```

以及：

```text
GET /.well-known/oauth-protected-resource
GET /api/chatgpt-status
```

`/api/chatgpt-status` 只回傳是否已配置 OAuth 與私人 storage adapters，
不回傳網址、token、secret 或使用者資料。系統採 fail-closed：未完成設定時
`/mcp` 不接受寫入；只有 OAuth 完整時才發布 protected-resource metadata。
即使 token 驗證成功，私人 adapters 未接通前 `record_meal` 亦不下載或保存
附件。

## 身份服務要求

正式接入應使用支援 OAuth 2.1、Authorization Code、PKCE S256、OIDC discovery
及 JWT access token 的身份服務。可選 Auth0 等成熟供應商；不要自行製作密碼
系統，也不要用查詢參數或自訂 API key 代替 OAuth。

身份服務需建立：

- API audience：建議使用正式 MCP resource URL。
- scope：`meal.write`。
- 唯一使用者帳戶：以 `marco@pui-pui.org` 登入。
- ChatGPT OAuth callback allowlist：
  `https://chatgpt.com/connector/oauth/{callback_id}`。

`callback_id` 只會在 ChatGPT 建立 connector 時出現；取得後再把精確 callback
加入身份服務，不能預先用 wildcard 放行。

## Vercel 環境變數

把 `.env.example` 的值加入 Vercel Preview 環境。不要把實際值提交至 Git：

```text
CHATGPT_MCP_RESOURCE_URL=https://<preview-domain>/mcp
CHATGPT_MCP_AUTHORIZATION_SERVER=https://<tenant>/
CHATGPT_MCP_ISSUER=https://<tenant>/
CHATGPT_MCP_AUDIENCE=https://<preview-domain>/mcp
CHATGPT_MCP_JWKS_URI=https://<tenant>/.well-known/jwks.json
CHATGPT_MCP_OWNER_HMAC_SECRET=<至少 32 bytes 隨機值>
```

私人資料層接通後才加入：

```text
CHATGPT_MCP_INGEST_HMAC_SECRET=<至少 32 bytes 隨機值>
CHATGPT_MCP_DATABASE_URL=<私人 PostgreSQL URL>
CHATGPT_MCP_PRIVATE_BLOB_TOKEN=<私人 object storage token>
```

目前程式不會因環境變數存在就假裝 storage 已接通；必須把實際 adapters
注入 MCP server 後，readiness 才可改為 `ready`。

## ChatGPT 連接

1. 先確認 `GET /api/chatgpt-status` 顯示 `authConfigured: true`。
2. 在 ChatGPT 的 Apps／Connectors 開發設定新增 MCP server URL：
   `https://<preview-domain>/mcp`。
3. 完成 OAuth 登入及同意 `meal.write`。
4. 確認 ChatGPT 能看到 `record_meal`，而且工具標示為寫入、非破壞性及
   可重試。
5. 在私人 adapters 完成前，只測試工具發現、OAuth 及安全鎖定；不要提交
   真實照片。

## 端到端驗收

正式容許一餐真實資料前，以下項目必須全部通過：

- 無 token、錯誤 issuer、錯誤 audience、過期 token、缺 `meal.write` 均被拒。
- 同一 `client_request_id` 重試不建立重複餐食或圖片。
- JPEG／PNG／WebP 以 magic bytes 及解碼確認，非圖片與超過 20 MB 被拒。
- redirect、private IP、loopback、link-local 及 DNS rebinding 被拒。
- EXIF、GPS、XMP、IPTC 已移除；來源 bytes 與短效 URL 不落盤、不入 log。
- 資料庫 RLS 及 owner mapping 的跨帳戶負面測試通過。
- 刪除餐食、刪除帳戶及 30 日 master lifecycle 實際可執行。
- iPhone ChatGPT 以「記錄這餐」觸發工具，澳門日期與餐別正確。
- 網站只能經已認證 API 讀取縮圖，不取得 object-storage URL。
- `pnpm privacy:scan`、單元測試、build 與手機視圖檢查全數通過。

## 產品邊界

`record_meal` 只記錄食物種類、烹調方式、餐別與可選備註，不估算卡路里、
重量或份量，不提供醫療診斷。Apple Watch／Apple Health 數值同步屬另一階段。

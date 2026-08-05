# ChatGPT 私人健康接入指南

## 能力與狀態

`codex/health-sync-phase2` 分支提供標準 Streamable HTTP MCP endpoint：

```text
https://<deployment-domain>/mcp
```

目前工具分為兩組：

- `get_health_summary`：按最近 1–31 日讀取已保存的私人日級健康摘要；唯讀，需要 `health.read`。
- `get_health_sync_status`：讀取最近同步時間、資料日期及狀態；唯讀，需要 `health.read`，不回傳裝置識別。
- `record_meal`：保存餐食 metadata 及相片；寫入，需要 `meal.write`。

這些是分支內已測試的程式能力，**尚未代表正式 Connector 已更新或 iPhone HealthKit 已接通**。ChatGPT 只在使用者對話中呼叫工具時讀取資料，不會定時同步，也不能直接讀取 HealthKit。真正的資料來源是獲授權的 iOS HealthBridge；它先把日級聚合送到私人 API，ChatGPT 才能讀取。

`GET /api/chatgpt-status` 只回傳 OAuth 與私人 adapters 是否配置，不回傳網址、token、secret、owner ID 或健康資料。缺少任何必要設定時系統 fail closed。

## OAuth 與最小權限

身份服務必須支援 OAuth 2.1、Authorization Code、PKCE S256、OIDC discovery 及 JWT access token。Auth0 API 應建立：

```text
Audience: https://health.pui-pui.org/api/mcp
Permissions: health.read, meal.write
```

只作健康分析的 Connector 應只要求 `health.read`。每個 MCP 工具會再次檢查自己的 scope；持有 `health.read` 不代表可以記錄餐食，持有 `meal.write` 亦不能讀取健康摘要。

目前只開放 Marco 的精確 Auth0 `sub`。家庭成員不得共用 Marco 的 Connector 或 owner ID；每人映射及跨帳戶負面測試完成前，家庭 Connector 保持關閉。

## Marco 的固定 owner 映射

現有餐食、Dashboard、iPhone HealthBridge 與 ChatGPT 必須使用完全相同的資料庫 owner ID：

```text
CHATGPT_MCP_OWNER_ID
AUTH0_WEB_LEGACY_OWNER_ID
SHORTCUT_OWNER_ID
```

Marco 過渡期間三者必須是同一現有值。這個值是私人識別，不可寫入 Git、文件、截圖或前端環境變數。程式同時檢查 `CHATGPT_MCP_ALLOWED_SUBJECT`；固定 owner ID 不能繞過 Auth0 身份驗證。

家庭成員則由家庭登入系統取得各自 owner ID，不能複製 Marco 的設定。未來若開放家庭 ChatGPT，需要建立經審核的 Auth0 subject-to-owner 映射，而不是讓一個固定 owner ID 接受多個 subject。

## Vercel 環境變數

先在隔離的 Preview 設定；不要先改 Production：

```text
CHATGPT_MCP_RESOURCE_URL=https://<preview-domain>/mcp
CHATGPT_MCP_AUTHORIZATION_SERVER=https://<auth-domain>/
CHATGPT_MCP_ISSUER=https://<auth-domain>/
CHATGPT_MCP_AUDIENCE=https://health.pui-pui.org/api/mcp
CHATGPT_MCP_JWKS_URI=https://<auth-domain>/.well-known/jwks.json
CHATGPT_MCP_ALLOWED_SUBJECT=<Marco 的精確 Auth0 user_id>
CHATGPT_MCP_OWNER_ID=<與現有 Marco owner ID 完全相同>
DATABASE_URL=<Preview 私人 PostgreSQL URL>
```

上述設定足以啟用唯讀健康工具。只有啟用 `record_meal` 時才另加：

```text
CHATGPT_MCP_INGEST_HMAC_SECRET=<至少 32 bytes 隨機值>
BLOB_READ_WRITE_TOKEN=<Preview private Blob token>
CHATGPT_MCP_ATTACHMENT_HOSTS=<ChatGPT 附件 host allowlist>
```

只有 Apple Health 寫入 API／HealthBridge 才需要：

```text
HEALTH_SYNC_TOKEN_SECRET=<至少 32 字元>
HEALTH_SYNC_CURSOR_SECRET=<至少 32 字元>
```

Preview 與 Production 使用不同秘密。任何 integration token、owner ID 或 access token 均不可交給 React、放入 `VITE_*`、localStorage、Git 或公開文件。

## ChatGPT Connector 設定

1. 在 Preview 確認 `/api/chatgpt-status` 的 `healthReadConfigured` 為 `true`；需要餐食寫入時再確認 `mealWriteConfigured`。
2. 在 Auth0 API 加入 `health.read` 與 `meal.write` permissions。
3. 在 ChatGPT Apps／Connectors 開發設定加入 Preview MCP URL。
4. 只讀健康 Connector 只同意 `health.read`；需要餐食寫入時才另加 `meal.write`。
5. 確認能看見兩個唯讀健康工具，並顯示 read-only、non-destructive。
6. 先用非敏感測試資料驗證；不要直接 promote 至 `health.pui-pui.org`。

## 端到端驗收

正式聲稱「ChatGPT 已接入健康資料」前，必須全部通過：

- 無 token、錯誤 issuer／audience、過期 token、錯誤 subject 均被拒。
- 缺 `health.read` 不能呼叫健康工具；缺 `meal.write` 不能呼叫餐食寫入。
- Marco Connector 只讀取 Marco owner；另一帳戶、另一 owner 及另一裝置均不能越界。
- 缺失值保持缺失，真實數值 `0` 不被當成缺失；澳門日期範圍正確。
- ChatGPT 回應不包含 owner ID、裝置 ID、token、資料庫 ID 或原始 HealthKit samples。
- 一個全新的 iPhone 同步具有 API 收據、已保存資料庫 row、Dashboard 同日顯示及 ChatGPT 同日摘要四項一致證據。
- `pnpm privacy:scan`、單元測試、build、E2E 與手機視圖全部通過。

## 產品邊界

ChatGPT 是授權後的唯讀解讀層，不是健康資料來源、排程器或醫療系統。它不會修改 Apple Health，不提供疾病診斷，也不承諾固定更新時間。健康資料更新頻率取決於 iOS HealthBridge 實際成功同步；ChatGPT 只在工具被呼叫時讀取當時已保存的最新資料。

# 家庭帳戶與邀請指南

家庭版採「共用平台、私人資料空間」：每位家人使用自己的登入帳戶、iPhone 上傳金鑰及資料擁有人 ID。家庭管理員可以決定哪些電郵獲邀請，但不會預設看到其他成員的餐食或健康資料。

## 安全邊界

- Auth0 Regular Web Application 處理登入；登入流程使用 Authorization Code、PKCE、state 及 nonce。
- 伺服器交換及驗證 ID token，再建立加密、HttpOnly、SameSite session Cookie；Auth0 token 不交給 React。
- 只有 `AUTH0_WEB_ALLOWED_EMAILS` 內且已驗證的電郵可以完成登入。
- owner ID 由 Auth0 subject 衍生，不以電郵作資料庫主鍵；日後更改電郵不會失去資料。
- PostgreSQL RLS 在資料庫層限制每次請求只能讀寫當前 owner。
- 私人圖片不提供公開 Blob URL；短效圖片 locator 與登入 session 必須屬於同一 owner。
- 每位成員最多保留 5 個 Shortcut 金鑰，可獨立撤銷。完整金鑰只在建立時顯示一次。

## Auth0 預覽設定

建立一個與 ChatGPT Connector 分開的 **Regular Web Application**。假設預覽網址是 `https://PREVIEW.example.vercel.app`：

- Allowed Callback URLs：`https://PREVIEW.example.vercel.app/api/auth/callback`
- Allowed Logout URLs：`https://PREVIEW.example.vercel.app/`
- Allowed Web Origins：`https://PREVIEW.example.vercel.app`

正式環境應使用獨立的 callback/base URL 設定。預覽確認前，不要改動 `health.pui-pui.org`。

## Vercel 環境變數

參照 `.env.example` 設定：

- `AUTH0_WEB_ISSUER`、`AUTH0_WEB_CLIENT_ID`、`AUTH0_WEB_CLIENT_SECRET`
- `AUTH0_WEB_BASE_URL`
- `AUTH0_WEB_ALLOWED_EMAILS`：以逗號分隔獲邀請電郵
- `AUTH0_WEB_ADMIN_EMAIL`：必須同時在 allowlist
- `WEB_SESSION_SECRET`、`AUTH0_WEB_OWNER_HMAC_SECRET`、`SHORTCUT_TOKEN_SECRET`
- `AUTH0_WEB_LEGACY_OWNER_EMAIL`、`AUTH0_WEB_LEGACY_OWNER_ID`：只用於保留 Marco 的既有資料
- `DATABASE_URL`、`BLOB_READ_WRITE_TOKEN`

所有 secret 必須只放在 Vercel encrypted environment variables，不可提交 Git、文件或截圖。Preview 與 Production 應使用不同 session/Shortcut secret。

## 保留 Marco 既有資料

第一次部署時，把 `AUTH0_WEB_LEGACY_OWNER_EMAIL` 設為 Marco 的登入電郵，`AUTH0_WEB_LEGACY_OWNER_ID` 設為現有 `SHORTCUT_OWNER_ID` 的完全相同值。登入後 Marco 會沿用舊 owner，因此現有餐食及相片不需要搬移或刪除。

這組 mapping 必須成對設定，而且啟用後不可隨意更改 owner ID。其他家庭成員會取得各自的新 owner ID。

## 資料庫升級

先備份，再在正確環境執行：

```bash
pnpm private-db:migrate
```

`meal-photo-v3-family.sql` 只新增每成員 Shortcut credential 表、索引與 RLS policy，不修改或刪除既有餐食、相片或 owner ID。

## 邀請一位家庭成員

1. 先取得對方同意及登入電郵。
2. 把電郵加入 Preview 的 `AUTH0_WEB_ALLOWED_EMAILS`，重新部署 Preview。
3. 請對方在 Safari 登入，確認只看見自己的空狀態，不會看見 Marco 的資料。
4. 對方在「飲食日誌」展開「iPhone 上傳設定」，建立自己的金鑰。
5. 把金鑰放入對方自己的「記錄餐食」Shortcut，傳送一張非敏感測試相片。
6. 確認對方看得到新紀錄，而 Marco 帳戶看不到。
7. 如金鑰曾經在訊息或截圖出現，立即撤銷並重建。

## 目前限制

- allowlist 由部署環境管理，尚未有管理員自助邀請頁。
- 家庭成員資料預設完全分開，尚未提供逐項同意分享。
- 尚未有忘記裝置、自助刪除、家庭資料匯出或監護人代理權限流程。
- 健康同步後端與登入後私人健康顯示已在開發分支完成，但尚未部署或完成真機保存閉環；正式網站健康趨勢仍使用清楚標示的 Demo Data。
- Marco 的 ChatGPT 固定 owner mapping 不能給家人共用；每位成員的 Connector 身份映射及跨帳戶負面測試完成前，家庭 ChatGPT 健康讀取保持關閉。

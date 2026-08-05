# 隱私說明

## 目前資料流

個人健康 Dashboard 的公開介面是唯讀應用，不提供人工輸入、匯入、上傳或修改健康紀錄；未解鎖時只載入清楚標示的虛構 Demo Data。私人餐食資料另存於受保護資料庫與私人物件儲存，不會隨公開網站程式碼發布。

- 只有獲邀請電郵可使用家庭帳戶登入
- 沒有分析追蹤工具
- 沒有廣告
- 沒有健康資料遙測
- 正式網站沒有 Apple Health／HealthKit 連線
- 正式網站沒有 Apple Health 指標上傳或自動跨裝置同步；開發分支能力不等於已部署
- 私人餐食只可由該成員自己的 Shortcut 金鑰寫入，並由該成員的登入 session 讀取

## 使用者責任

Apple 健康匯出與其他健康檔案屬敏感個人資料。使用者應把檔案存放在受密碼、裝置鎖或加密保護的位置，並避免傳送至不受信任服務。未建立登入及私人資料後端前，不可把真實健康紀錄提交到公開 GitHub repository 或任何公開部署。

Shortcut 上傳金鑰屬敏感秘密，不應放入截圖、訊息、Git、公開文件或其他人可讀取的捷徑。若裝置遺失或金鑰懷疑外洩，成員應立即在 Dashboard 撤銷。登入使用加密、HttpOnly、SameSite session Cookie；瀏覽器 JavaScript 不接觸 Auth0 權杖。Dashboard 不把上傳金鑰或私人 API 回應寫入 `localStorage`、`sessionStorage` 或 PWA cache。

## 食物照片私隱邊界

手機入口是專用 iPhone Shortcut。它把 1–4 張 JPEG、PNG 或 WebP 圖片直接編碼成 Base64，連同日期、餐別及標籤送到同源 HTTPS API；不接受外部照片網址。伺服器會在驗證該成員的 Bearer 上傳金鑰後才解析及儲存，並重新編碼圖片以移除 EXIF/GPS。資料庫以每位成員的固定、不透明擁有人 ID 及 RLS 隔離；圖片放在私人物件儲存。家庭管理員只管理邀請，不會預設取得其他成員的健康或餐食資料。

Dashboard 的私人 API 只向已登入的資料擁有人回傳餐食日期、餐別、標籤、做法、備註、相片張數、不透明 ID 及短效圖片代理 URL，不回傳資料庫 ID、內容 hash、object key 或公開 Blob URL。圖片代理會再次核對 session 擁有人。所有私人 API 使用 `Cache-Control: private, no-store`，亦不進 PWA cache。伺服器不得記錄金鑰、Base64 圖片或健康內容到 console。

清理後的 master 設定 30 日刪除期限；縮圖保留至餐食被刪除。自動刪除工作及使用者自助刪除仍待後續補充，因此現階段不要提交不希望長期留存的照片。

## Demo Data

首次載入的 14 日健康記錄與飲食照片佔位內容均為程式內的虛構示例，介面會顯示「Demo Data · 非真實資料」。它們不是 Apple Health 或真實飲食資料，也不代表任何真實個人的健康狀況。公開網站沒有新增或匯入真實資料的入口。

## ChatGPT 健康讀取邊界

開發分支的 ChatGPT 工具只可在 OAuth `health.read` 授權後讀取該 owner 已保存的日級摘要與同步狀態。回應不包含 owner ID、裝置 ID、token、資料庫 ID或原始 HealthKit samples。ChatGPT 不會定時同步、修改 Apple Health 或自行產生健康觀測；正式 Connector 更新前仍須完成 Preview 及真機端到端驗證。

## 健康資訊聲明

本工具只協助記錄習慣和檢視趨勢，不提供疾病診斷、治療、處方或緊急醫療建議。任何健康疑慮應由合資格專業人士評估。

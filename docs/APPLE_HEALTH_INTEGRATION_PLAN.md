# Apple Health 第二階段整合計劃

## 邊界

第一階段沒有連接 Apple Health，也沒有即時或背景同步。公開 Dashboard 採唯讀模式，只展示 Demo Data；私人 ChatGPT 導入與 Apple Health 真機資料管道均尚未部署。

## 實作狀態（2026-08-05）

第二階段目前已在 `codex/health-sync-phase2` 分支完成私人同步後端的第一個可審核切片：

- 日級聚合 JSON contract、嚴格欄位／日期／時區驗證及 31 日批次上限；
- 每成員、每裝置的可撤銷同步憑證；
- PostgreSQL schema、強制 RLS、冪等請求紀錄及裝置 cursor；
- 寫入、私人健康資料讀取、同步狀態及裝置管理 API；
- 部分欄位更新、較新 HealthKit 修正值及重試去重規則的單元測試。

這只代表程式碼已準備接受審核，**不代表已套用 Preview／Production 資料庫，也不代表已連接 iPhone HealthKit**。下一個工程里程碑是建立最小原生 iOS Companion App，先用「手動同步」在 Preview 完成一個真實請求、資料庫保存及 Dashboard 顯示的閉環；其後才評估背景同步。

## 為何一般網頁不能直接讀取 Apple Health

Apple Health 資料由 iOS 的 HealthKit 權限模型保護。HealthKit 是原生 Apple 平台框架，資料存取須由已簽署的 iOS App 逐類型向使用者請求權限；Safari 網頁沒有 HealthKit JavaScript API，也不能繞過 App sandbox 直接讀取健康資料。因此純 Web App 只能接收使用者主動匯出的檔案，或由獲授權的原生／第三方工具把資料傳遞給它。

## 方案比較

| 方案 | 自動化程度 | 開發成本 | 隱私風險 | 維護成本 | 每日同步 | 適用情境 |
| --- | --- | --- | --- | --- | --- | --- |
| iOS Shortcut 匯出 | 中 | 低 | 低至中；視捷徑目的地 | 低至中；iOS 更新可能影響動作 | 可，由個人自動化觸發，但常需確認 | 快速驗證少量欄位與每日流程 |
| Apple Health XML 匯出 | 低 | 低至中；解析檔案即可 | 低；可完全本機處理，但檔案含大量敏感資料 | 中；需處理大型 XML 與 schema 差異 | 否，通常是手動全量匯出 | 歷史資料一次性匯入 |
| Health Auto Export 類工具 | 高 | 低至中 | 中至高；取決於第三方、傳輸和儲存位置 | 中；受第三方版本與收費影響 | 通常支援 | 個人快速自動化原型 |
| 原生 iOS Companion App | 高 | 高 | 低至中；可設計為裝置內處理 | 高；需 Apple 開發者帳號、簽署、App 維護 | 支援，受 iOS 背景執行限制 | 長期、可控、正式產品路線 |
| 自建 HealthKit Bridge | 高 | 很高 | 可控但責任最高；涉及傳輸、驗證與後端安全 | 很高；iOS、API、資料庫與監控均需維護 | 支援，仍受 HealthKit 背景限制 | 確有跨裝置／雲端需求時 |

## 各方案注意事項

### 1. iOS Shortcut

- 只擷取已批准的最少欄位，例如步數、活動能量、運動分鐘、睡眠。
- 以固定 JSON schema 輸出至受保護的私人導入服務，不直接傳送到公開 Dashboard。
- 先在澳門時區 `Asia/Macau` 驗證跨午夜、睡眠跨日及重複執行。
- 不應把健康內容寫入捷徑日誌或未受控 webhook。

### 2. Apple Health XML

- 適合建立歷史基線，不適合每日操作。
- 解析應以串流方式進行，避免大型匯出檔令瀏覽器記憶體不足。
- 匯入前先讓使用者選擇資料種類和日期範圍。

### 3. Health Auto Export 類工具

- 上線前需逐項審核隱私政策、資料保留、出口位置與第三方處理者。
- 優先選擇寫入使用者自有儲存空間、可限制欄位且可關閉雲端中轉的方案。
- 第三方工具可作驗證，不應在未審核前成為唯一資料來源。

### 4. 原生 iOS Companion App

- 使用 HealthKit entitlement 和逐類型授權。
- App 只把使用者批准的聚合日資料交給 Web Dashboard。
- 需定義撤銷權限、刪除、重試、去重、時區及來源追蹤。
- 「每日同步」不能承諾精確時間；iOS 會管理背景執行時機。

### 5. 自建 HealthKit Bridge

- 組成包括 iOS 採集端、認證 API、加密傳輸、資料庫、刪除機制及稽核。
- 在確定需要跨裝置或遠端查看前，不值得承擔此複雜度。
- 不應把原始 HealthKit 明細無差別上傳；優先傳送日級聚合。

## 推薦第二階段路線

採用「最小原生 Companion App + 受控私人聚合 API」：

1. 先鎖定日級欄位、單位、澳門時區、缺失值、修正值及去重 contract（已在分支完成）。
2. 建立使用 Auth0 Native Application、Authorization Code + PKCE 的 iOS App；不把 client secret 放入 App。
3. 首次同步最近 30 日，其後以 HealthKit anchored query 找出受影響日期，再重新計算最近 7 日作修正窗口。
4. 裝置只上傳使用者授權的日級聚合；不傳原始 sample、sample UUID、來源 App、裝置序號或完整時間線。
5. 先驗證手動同步的端到端收據，再加入 HealthKit observer/background delivery；背景更新由 iOS 排程，不能承諾固定分鐘數。
6. 完成 2–4 週真實使用、撤銷、重試、跨午夜及睡眠歸日驗證後，才提升至正式網域及邀請其他家庭成員。

ChatGPT 在這條路線中先擔任經 OAuth 授權的**唯讀解讀層**，讀取已保存的日級摘要；它不是 HealthKit 資料來源，也不直接持有 iPhone HealthKit 權限。任何寫入或修改健康資料的能力另行審核。第一階段及目前分支均不會聲稱或模擬 Apple Health 即時同步。

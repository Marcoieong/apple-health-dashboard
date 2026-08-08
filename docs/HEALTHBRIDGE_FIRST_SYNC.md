# HealthBridge 首次真機同步

## 這個版本會做甚麼

`ios/HealthBridge` 是私人 iPhone Companion App。它使用 HealthKit 的唯讀權限，在手機本機按日整理以下資料，再以每部裝置獨立的加密憑證送到 Health Dashboard：

- 步數；
- 活動能量（kcal）；
- Apple 運動分鐘；
- 睡眠時數；
- 體重；
- 體脂率。

首次手動同步會重算最近 30 日。它不讀取病歷、藥物、位置或逐筆原始樣本，也不會寫入 Apple Health。

## 資料流程

```text
iPhone Apple Health
  → HealthBridge 本機日級聚合
  → Auth0 家庭帳戶確認
  → 裝置金鑰存入 iPhone Keychain
  → POST /api/health-sync/v1/days
  → 私人 PostgreSQL 日級紀錄
  → Dashboard／ChatGPT 唯讀摘要
```

ChatGPT 不會直接連接或定時讀取 Apple Health。它只在你呼叫健康工具時，讀取已由 HealthBridge 保存到私人資料庫的最新摘要。

## 在 Xcode 安裝到 iPhone

1. 用 USB 或已配對的 Wi-Fi 連接 iPhone，保持解鎖並信任這部 Mac。
2. 開啟 `ios/HealthBridge/HealthBridge.xcodeproj`。
3. 在 **Signing & Capabilities** 選擇你的 Apple Developer Team，保留 **Automatically manage signing**。
4. 確認 **HealthKit** capability 存在。
5. 在 Xcode 上方選擇你的 iPhone，按 Run。
6. 如 iPhone 要求，於「設定 → 私隱與保安 → 開發者模式」啟用 Developer Mode。

目前 bundle identifier 是 `org.pui-pui.HealthBridge`，最低系統版本是 iOS 17。

## 第一次同步

1. 在 HealthBridge 按「連接私人帳戶」。
2. Safari 以 `marco@pui-pui.org` 登入 Auth0，核對授權內容後按「確認並連接」。
3. 返回 HealthBridge，按「允許讀取 Apple Health」，在 Apple 權限頁只開啟你願意分享的指標。
4. 按「同步最近 30 日」。
5. App 顯示伺服器接受的日數及同步時間後，才算手機請求成功。

## 驗收證據

首次真實同步必須同時通過以下四項，不能以編譯或模擬請求代替：

1. iPhone HealthBridge 顯示同步成功及伺服器收據；
2. 私人同步狀態 API 顯示該裝置及最近同步時間；
3. Dashboard 顯示同一天的真實資料，並不再標示為 Demo Data；
4. ChatGPT 的 `get_health_summary`／`get_health_sync_status` 讀到相同日期及更新時間。

## 更新頻率

此切片採用使用者按鈕觸發的手動同步，目的是先驗證安全閉環。下一切片才加入 `HKObserverQuery`／background delivery：Apple 由 iOS 決定實際喚醒時間，因此只能描述為「資料有變更時盡快同步」，不能承諾每幾分鐘固定更新。App 每次被打開時亦會補做同步，避免背景排程延遲。

## 安全邊界

- 裝置金鑰只會經自訂 URL 的 fragment 返回 App，並存於 Keychain；授權 HTML 不會取得或顯示金鑰。
- 後端只接受已批准的日級欄位，最多每批 31 日。
- 每位家庭成員及每部裝置使用獨立 owner／device 範圍，不共享金鑰。
- Preview 完成真機驗收前，不更新 `health.pui-pui.org`。


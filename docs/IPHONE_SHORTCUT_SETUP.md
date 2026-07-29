# iPhone Shortcut 餐食記錄設定

此 Shortcut 是目前正式的私人餐食輸入入口：

```text
iPhone Shortcut
  → HTTPS + Bearer 存取碼
  → health.pui-pui.org/api/shortcut/meal
  → 私人 PostgreSQL + 私人物件儲存
  → Dashboard 私人唯讀摘要
```

網站不會恢復人工健康數據輸入頁。存取碼不要放入 Git、截圖、公開分享的捷徑或網址。

## 建議的第一版：每次一張照片

先建立可靠的一張照片版本；伺服器已支援每餐 1–4 張，日後才擴充多圖迴圈。

1. 在 iPhone 開啟「捷徑」，新增捷徑，名稱設為「記錄餐食」。
2. 加入「選取相片」，關閉「選取多張」。
3. 加入「轉換影像」：
   - 格式：JPEG
   - 品質：中等或約 70%
   - 「保留中繼資料」：關閉
4. 加入「Base64 編碼」，輸入使用上一步的 JPEG，關閉換行。
5. 加入「從選單中選擇」，提示為「餐別」，加入四項：
   - 早餐 → `breakfast`
   - 午餐 → `lunch`
   - 晚餐 → `dinner`
   - 小食 → `snack`
6. 加入「要求輸入」，提示為「食物種類，以逗號分隔」，例如 `雞肉,西蘭花,白飯`。
7. 把輸入文字以逗號「分割文字」，得到食物標籤清單。
8. 可選：再要求輸入「烹調方式」，例如 `烤,清蒸`，同樣以逗號分割。
9. 加入「目前日期」，再用「格式化日期」設為自訂格式 `yyyy-MM-dd`。
10. 加入「產生 UUID」。這個值作為本次要求的 `client_request_id`。
11. 建立一個「字典」作為相片項目：

```json
{
  "data_base64": "選取 Base64 編碼的魔術變數",
  "mime_type": "image/jpeg",
  "file_name": "meal.jpg"
}
```

12. 建立「列表」，放入剛才的相片字典。
13. 建立主「字典」：

```json
{
  "photos": "選取相片列表的魔術變數",
  "client_request_id": "選取 UUID 的魔術變數",
  "local_date": "選取格式化日期的魔術變數",
  "timezone": "Asia/Macau",
  "meal_type": "選取餐別的英文值",
  "food_labels": "選取食物標籤清單",
  "preparation_methods": "選取烹調方式清單"
}
```

`notes` 是可選字串；不需要時不要加入。食物種類最多 30 項、每項最多 80 字；做法最多 12 項、每項最多 60 字；備註最多 500 字。

14. 加入「取得 URL 的內容」：
   - URL：`https://health.pui-pui.org/api/shortcut/meal`
   - 方法：`POST`
   - Request Body：`JSON`
   - JSON：選取主字典
   - Header `Authorization`：`Bearer 你的私人存取碼`
   - Header `Content-Type`：`application/json`
15. 加入「顯示通知」，內容使用 API 回應：
   - `recorded`：已新增
   - `already_recorded`：同一次要求已經記錄，沒有重複新增

## 使用 Dashboard 查看

1. 在 Safari 開啟 `https://health.pui-pui.org`。
2. 進入「飲食日誌」。
3. 在「私人存取碼」貼上同一存取碼，按「載入私人紀錄」。
4. 私人頁只顯示日期、餐別、食物標籤、做法、備註及相片張數，不載入私人圖片。
5. 按「鎖定」、重整或關閉頁面後，存取碼及私人回應會從頁面記憶體清除。

## 容量與格式

- 每餐 1–4 張
- JPEG、PNG 或 WebP
- 單張解碼後最多 2 MiB
- 每餐合計最多 3 MiB
- 建議 Shortcut 先轉成約 70% 品質 JPEG
- 伺服器會再次重新編碼以去除 EXIF/GPS；iPhone 端關閉 metadata 是額外保護

## 常見錯誤

- `401 unauthorized`：存取碼錯誤、前後有空格，或已被輪替。
- `400 invalid_input`：日期、餐別、欄位或 Base64 格式不正確。
- `409 idempotency_conflict`：同一 UUID 曾配合不同內容使用；重新產生 UUID 再送出。
- `415 unsupported_image`：圖片格式不支援、宣告類型與內容不符或圖片太大。
- `503 service_locked`：部署環境尚未完整設定秘密或私人儲存。

## 安全事項

- 不要分享含有存取碼的 Shortcut。
- 不要把存取碼放在 Shortcut 名稱、通知、URL query string 或截圖。
- iPhone 必須設有裝置密碼；建議關閉鎖定畫面執行。
- 若懷疑外洩，停止使用並在 Vercel 立即輪替 `SHORTCUT_ACCESS_TOKEN`。
- 現階段尚未提供自助刪除；第一次實機測試只使用明確標示的測試餐食。

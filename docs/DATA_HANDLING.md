# 資料處理說明

## 儲存格式

資料以 JSON envelope 儲存在 `localStorage`：

```json
{
  "schemaVersion": 1,
  "records": []
}
```

storage key 為 `personal-health-dashboard:v1`。所有寫入集中在 `src/services/storage.ts`，並保留 deterministic migration placeholder 供未來 schema 升級。

## 資料生命週期

1. 第一次開啟：若沒有既有 envelope，建立約 14 日 Demo Data。
2. 新增／編輯：驗證表單後寫入同一 envelope；每個日期只容許一筆紀錄。
3. 刪除：只移除選定紀錄。
4. 清除全部：經瀏覽器確認後把 records 改為空陣列。
5. 匯出 JSON：包含 schema version、匯出時間與紀錄。
6. 匯出 CSV：供個人試算表分析。
7. 匯入 JSON：逐筆驗證日期、非負數值與布林欄位，依日期去重；只要有有效紀錄，匯入清單會取代目前清單。執行前應先匯出備份。

## 錯誤及缺失資料

- 損壞的本機 envelope 會 fail closed，畫面顯示錯誤，不會默默改寫。
- 無法解析或結構錯誤的匯入檔不會寫入。
- 欄位可留空；摘要與畫面以「—」表示缺失，不把缺失數值當成零。
- 評分只對有提供的評分類別計分，結果同時列出缺失欄位及紀錄是否完整。

## Git 與檔案

Demo Data 可提交；真實資料不可提交。`.gitignore` 已排除：

- `exports/`
- `private-data/`
- `*.health-export.json`
- `*.health-export.csv`
- 一般 `*.local` 與 log

## 復原建議

每週或在大量編輯前匯出 JSON。還原前保留目前備份，並先在獨立瀏覽器 profile 驗證匯入檔。第一階段沒有雲端版本歷史或復原站。

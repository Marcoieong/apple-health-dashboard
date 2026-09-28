# 個人健康 Dashboard

私人健康摘要網站：[health.pui-pui.org](https://health.pui-pui.org/)。

## 版本狀態（2026-09-29 核對）

- 本次整合的已驗收程式基線：[`codex/dashboard-information-order`](https://github.com/Marcoieong/apple-health-dashboard/tree/codex/dashboard-information-order)，commit `61a05733b77507a492c9d43a787974b7fcd7643d`。
- `main` 為唯一正式分支，Vercel 為正式部署平台。本次整合納入已驗收程式與文件清理；私人工作目錄的未提交修改不在本次範圍。
- 正式網站由 Vercel 提供；需要登入才能讀取私人健康資料。
- 今日、每週、每月先顯示健康數字、已完成活動及圖表，分析建議在後，資料來源和系統狀態置底並可收合。
- 自訂 ChatGPT MCP 提供唯讀健康摘要與同步狀態；這不是官方 ChatGPT Health。
- 官方 ChatGPT Health 回答自動回寫 Dashboard：**未驗證**。本機收件箱排程存在，但正式建議匯入端點目前回傳 404。

## 文件

- [部署與分支](docs/DEPLOYMENT.md)
- [資料來源與證據邊界](docs/DATA_HANDLING.md)
- [隱私](docs/PRIVACY.md)
- [ChatGPT 接入沿革與目前卡點](docs/CHATGPT_CONNECTION.md)

舊的展示版設計規格、視覺驗收、截圖及階段規劃已從本分支移除，可透過 Git 歷史追溯；它們不能充當目前正式版本的驗收證據。

## 開發

開發分支從 main 建立，完成 lint、測試、build 與 Vercel 預覽驗收後才合併 main。私人資料、憑證及真實健康畫面不得提交。

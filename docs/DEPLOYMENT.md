# 部署與分支

核對日期：2026-09-29（Asia/Macau）。

## 單一正式發布流程

- 正式網站：https://health.pui-pui.org/
- 唯一正式分支：`main`；Vercel Git productionBranch 亦為 `main`。
- 本次整合的應用程式基線：已驗收 commit `61a05733b77507a492c9d43a787974b7fcd7643d`。
- 開發分支先通過 lint、測試、build 及 Vercel 預覽，再合併 main 發布。
- 舊分支保留歷史；不作為另一個正式發布入口。

## GitHub Pages

已移除 Pages 發布工作流程、解除 Pages 的 health.pui-pui.org 自訂網域，並改為 workflow 模式，避免 gh-pages 分支推送再觸發發布。DNS 未修改。

GitHub DELETE Pages API 仍可能拒絕停用（HTTP 422）；解除自訂網域與停用舊發布流程不等於舊 github.io 網址已下線。此限制須以 API 回應和實際網址另行核對。

## 範圍與核對

本次整合未納入本機尚未提交的登入、HealthBridge、同步或建議匯入修改。每次發布均需核對 Vercel 部署、來源 commit、網站回應及私人資料存取；HTTP 200 不代表健康資料更新或全自動同步完成。

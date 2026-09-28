# 部署與分支

核對日期：2026-09-29（Asia/Macau）。

## 正式版本

- 網站：https://health.pui-pui.org/
- 平台：Vercel；HTTP 200，部署狀態 READY。
- 部署：`dpl_C1Sk2zunVgQqJm2313tmWaAnFSFY`。
- 已驗收來源：`codex/dashboard-information-order`，commit `61a05733b77507a492c9d43a787974b7fcd7643d`。
- 已驗收預覽：https://apple-health-dashboard-dmveuacr6-marco-315e.vercel.app

## 發布限制

Vercel 的 Git 連結仍把 `main` 設為 productionBranch；main 的程式是歷史展示原型。文件更新本身也可能觸發舊程式部署。因此此文件清理 PR 暫不合併，需先使正式分支與已驗收來源一致，或另行完成部署設定調整。

GitHub Pages 是被 Vercel 取代的舊展示部署，不再用作正式網站。舊 gh-pages 分支保留作歷史記錄。未修改 DNS。

不要把本機尚未提交的登入、HealthBridge、同步或建議匯入程式一併發布。每次應核對實際部署、來源 commit、測試與資料存取結果。

# 開發路線

## Phase 1 — Architecture and Product Management

完成靜態 PWA、IndexedDB 基礎、商品管理、搜尋分類、圖片本機儲存、響應式繁體中文介面、自動測試與文件。

## Phase 2 — Location Sheet Management

實作獨立的地點清單 CRUD。檢查地點刪除時的關聯清理，加入城市/國家等欄位驗證，並為現有資料設計不破壞的 migration。

## Phase 3 — Product-Location Lookup and Statistics

在地點頁從既有商品庫選取多項商品，記錄價格、幣別與備註，提供商品與地點雙向查詢及本機統計。維持複合唯一鍵，避免重複商品與重複關聯。

## Phase 4 — Local Backup, Restore, and Product Polish

提供使用者自行匯出、驗證與還原的版本化備份；處理衝突、缺失圖片及容量不足。改善大量商品的搜尋、分類管理與圖片壓縮體驗。

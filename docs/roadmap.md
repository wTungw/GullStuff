# 開發路線

## Phase 1 — Architecture and Product Management

完成靜態 PWA、IndexedDB 基礎、商品管理、搜尋分類、圖片本機儲存、響應式繁體中文介面、自動測試與文件。

## Phase 2 — Location Sheet Management

已完成獨立的地點清單 CRUD、地點刪除時的關聯清理、欄位長度驗證，以及保留既有資料的 v1 → v2 migration。

## Phase 3 — Product-Location Lookup and Statistics

已可在地點頁從既有商品庫選取多項商品並建立關聯；地點詳情為獨立頁面，顯示已連結商品及其購買資訊。商品詳情可反查可購買地點、檢視地點詳情及取消連結。新增關聯時優先連結既有地點；找不到時新增預選商品的地點。每個關聯可獨立記錄價格、幣別與購買備註。接下來加入本機統計。持續維持複合唯一鍵，避免重複商品與重複關聯。

## Phase 4 — Local Backup, Restore, and Product Polish

提供使用者自行匯出、驗證與還原的版本化備份；處理衝突、缺失圖片及容量不足。改善大量商品的搜尋、分類管理與圖片壓縮體驗。

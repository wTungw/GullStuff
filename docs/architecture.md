# 架構說明

## 決策

採用 Vue 3 + Vite 的靜態 PWA，資料放在瀏覽器 IndexedDB，由 Dexie 統一存取。這個選擇讓手機和桌面共用一套介面、可從靜態主機分發、首次載入後離線使用，且無需維護後端。Vue 3 使用 JavaScript 與 Composition API，符合專案既有開發偏好。

評估過的替代方案：原生行動應用的儲存控制與系統整合更強，但需多平台開發與發佈流程；純 `localStorage` 對圖片、容量與交易一致性不足；SQLite/WASM 增加套件與持久化複雜度。PWA 的代價是資料仍受瀏覽器儲存政策約束，安裝方式和空間上限不如原生應用穩定。未來若可靠離線儲存與裝置整合需求超過 PWA 能力，可保留 UI 與 domain 操作，替換 repository 層為原生 SQLite。

行動端另以 Capacitor 包裝為 Android 原生應用（`appId` com.gullstuff.app，`webDir` 指向建置產物 `dist`），與桌面共用同一套 Vue 資料層、介面與備份核心；桌面端維持靜態 PWA／瀏覽器。Capacitor 只進入 Android 專案與原生適配器，純 web 建置不靜態依賴任何原生 plugin。

## 資料模型

IndexedDB `gullstuff` schema v2（由 v1 非破壞性升級）：

| Store | 主要欄位 | 索引與規則 |
| --- | --- | --- |
| `products` | `id`, `name`, `imageReference`, `brand`, `category`, `model`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`name`, `category`, `createdAt`, `updatedAt` |
| `images` | `id`, `blob` | 主鍵 `id`；Blob 與商品分開存 |
| `locations` | `id`, `name`, `country`, `city`, `area`, `address`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`name`, `country`, `city`, `area`, `updatedAt` |
| `locationProducts` | `id`, `productId`, `locationId`, `price`, `currency`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`productId`, `locationId`，複合唯一索引 `[locationId+productId]` 防止重複關聯 |

商品與地點各有獨立 CRUD；商品名稱經 NFKC、空白與大小寫正規化後不可重複，地點以名稱、國家、城市與地址的正規化組合判定重複。此檢查在寫入 transaction 中進行，既有資料不會被自動改名或刪除。一個地點可連多件商品，同一件商品也可連多個地點，`[locationId+productId]` 唯一索引防止同一組關聯重複。在地點表單可從既有商品中選取多項並建立基本關聯；價格、幣別及購買備註則在商品的地點詳情中編輯，只更新該組關聯。舊關聯沒有這些欄位時仍可讀取。UUID 是穩定識別碼；時間戳為 ISO 8601。地點及其商品關聯在同一個 IndexedDB transaction 中儲存；取消選取時移除關聯，保留其他關聯上的價格等資料。刪除商品會清除圖片與關聯並保留地點；刪除地點會清除關聯並保留商品。IndexedDB 本身不提供外鍵，需由 repository transaction 維持參照完整性。

Dexie schema version 管理升級。v2 加入地點的 `area` 索引，並補齊舊地點缺失的選填欄位與時間戳；既有資料保留。備份採獨立於 IndexedDB 的格式並帶獨立版本號，匯入先驗證記錄、ID、重複關聯、圖片與參照完整性，再於單一 transaction 內取代式還原；不將 IndexedDB 原始內部結構直接當作備份格式（詳見「備份與還原」）。

## 資料流

```text
Vue 畫面 → ProductForm / ProductCard → products.js (驗證與 CRUD)
                                     → Dexie → IndexedDB
Vue 地點列表 / 表單 → locations.js (驗證與 CRUD) → Dexie → IndexedDB
地點表單商品勾選 → locations.js (關聯同步) → locationProducts store
地點詳情 → locations.js (商品與購買資訊反查) → locationProducts / products store
裝置圖片 → image.js (尺寸/格式處理) → products.js → images store
images store → useImageUrl.js → 暫時 Object URL → 畫面
設定備份 → backup.js (exportBackup) → zip 容器 → platform 適配器 (web 下載 / native Filesystem+Share)
匯入備份 → platform 適配器 → backup.js (validate → restore) → Dexie transaction (清空四 store 再寫入)
```

Component 不直接操作 IndexedDB，圖片 URL 在不需要時釋放。名稱搜尋與分類篩選在記憶體中執行，避免每次輸入都發動 IndexedDB 查詢；對個人收藏量足夠，若未來達到數萬筆再考慮索引或分頁。分類由現有商品產生，因此 API/schema 變更主要集中在資料層；新增欄位需要更新表單與展示。新裝置型號目前不是產品需求，無需策略層。

## 備份與還原

備份是獨立於 IndexedDB 的單一檔案格式：`.gullstuff` 為 zip 容器，內含 `manifest.json` 與 `images/` 目錄下的圖片位元組。`manifest.json` 記錄 `format`、`schemaVersion`（備份格式版本，與 IndexedDB 的 `dbSchemaVersion` 各自版本化）、`appVersion`、建立時間、平台，以及 `products`、`locations`、`locationProducts`、`images` 四組完整記錄與筆數。圖片以二進位條目存放，匯出時對已壓縮的 WebP／JPEG／PNG 不再重複壓縮。

匯入採兩階段驗證，全部通過才還原：先檢查容器與信封（可解壓、存在 manifest、`format` 正確、`schemaVersion` 與 `dbSchemaVersion` 不超過目前支援版本），再逐筆檢查記錄格式、各集合 ID 唯一、商品名稱與地點識別唯一、商品地點關聯重複、參照完整性（關聯指向的商品與地點存在）與圖片存在。缺少的圖片以警告略過（商品存活、圖片置空），未被任何商品引用的圖片則直接跳過，避免還原無關位元組。

還原為取代式（destructive）：於單一 Dexie transaction 內先清空 `products`、`images`、`locations`、`locationProducts` 四個 store，再寫入備份內容。所有解壓、JSON 解析與 Blob 構建都在 transaction 外先完成，transaction 內只執行 Dexie 操作，避免非 Dexie 的 await 觸發自動 commit 而留下半寫入狀態。目前僅支援取代式；合併模式、加密與排程備份仍屬後續工作。

備份核心 `src/data/backup.js` 只處理壓縮、解析、驗證與原子還原，不含任何 Capacitor、DOM 或下載邏輯，因此可同時被 web 與 native 層共用。`src/platform/` 提供檔案適配器接縫：web 端用 Blob 下載與 `<input type="file">` 選檔；native（Capacitor Android）端用 `@capacitor/filesystem` 寫入 Documents（失敗退回 Cache）並透過 `@capacitor/share` 分享，匯入則沿用 web 的檔案輸入。`src/platform/backupFile.js` 依 `Capacitor.isNativePlatform()` 選擇實作，讓畫面端只需呼叫同一組 `readBackupFile`／`saveBackupFile` 即可。

## 隱私與網路

沒有 API server、登入、同步、追蹤或第三方資源。PWA 的 Service Worker 只快取建置產物；商品 CRUD 和查詢只讀寫 IndexedDB，不發出網路請求。初次載入或版本更新會向部署的靜態主機下載程式，部署商可能有一般存取日誌，但不會收到使用者輸入的商品資料。離線使用需先完成載入與快取。瀏覽器儲存並非永久保證，Phase 4 已提供可攜式本機備份與還原（取代式），但仍無雲端同步。

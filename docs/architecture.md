# 架構說明

## 決策

採用 Vue 3 + Vite 的靜態 PWA，資料放在瀏覽器 IndexedDB，由 Dexie 統一存取。這個選擇讓手機和桌面共用一套介面、可從靜態主機分發、首次載入後離線使用，且無需維護後端。Vue 3 使用 JavaScript 與 Composition API，符合專案既有開發偏好。

評估過的替代方案：原生行動應用的儲存控制與系統整合更強，但需多平台開發與發佈流程；純 `localStorage` 對圖片、容量與交易一致性不足；SQLite/WASM 增加套件與持久化複雜度。PWA 的代價是資料仍受瀏覽器儲存政策約束，安裝方式和空間上限不如原生應用穩定。未來若可靠離線儲存與裝置整合需求超過 PWA 能力，可保留 UI 與 domain 操作，替換 repository 層為原生 SQLite。

## 資料模型

IndexedDB `gullstuff` schema v2（由 v1 非破壞性升級）：

| Store | 主要欄位 | 索引與規則 |
| --- | --- | --- |
| `products` | `id`, `name`, `imageReference`, `brand`, `category`, `model`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`name`, `category`, `createdAt`, `updatedAt` |
| `images` | `id`, `blob` | 主鍵 `id`；Blob 與商品分開存 |
| `locations` | `id`, `name`, `country`, `city`, `area`, `address`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`name`, `country`, `city`, `area`, `updatedAt` |
| `locationProducts` | `id`, `productId`, `locationId`, `price`, `currency`, `notes`, `createdAt`, `updatedAt` | 主鍵 `id`；`productId`, `locationId`，複合唯一索引 `[locationId+productId]` 防止重複關聯 |

商品與地點各有獨立 CRUD；商品名稱經 NFKC、空白與大小寫正規化後不可重複，地點以名稱、國家、城市與地址的正規化組合判定重複。此檢查在寫入 transaction 中進行，既有資料不會被自動改名或刪除。一個地點可連多件商品，同一件商品也可連多個地點，`[locationId+productId]` 唯一索引防止同一組關聯重複。在地點表單可從既有商品中選取多項並建立基本關聯；價格、幣別及購買備註則在商品的地點詳情中編輯，只更新該組關聯。舊關聯沒有這些欄位時仍可讀取。UUID 是穩定識別碼；時間戳為 ISO 8601。地點及其商品關聯在同一個 IndexedDB transaction 中儲存；取消選取時移除關聯，保留其他關聯上的價格等資料。刪除商品會清除圖片與關聯並保留地點；刪除地點會清除關聯並保留商品。IndexedDB 本身不提供外鍵，需由 repository transaction 維持參照完整性。

Dexie schema version 管理升級。v2 加入地點的 `area` 索引，並補齊舊地點缺失的選填欄位與時間戳；既有資料保留。未來備份格式應帶有獨立版本號，匯入先驗證記錄、ID、重複關聯、圖片與參照完整性，再於 transaction 內還原；不要將 IndexedDB 原始內部結構當作備份格式。

## 資料流

```text
Vue 畫面 → ProductForm / ProductCard → products.js (驗證與 CRUD)
                                     → Dexie → IndexedDB
Vue 地點列表 / 表單 → locations.js (驗證與 CRUD) → Dexie → IndexedDB
地點表單商品勾選 → locations.js (關聯同步) → locationProducts store
地點詳情 → locations.js (商品與購買資訊反查) → locationProducts / products store
裝置圖片 → image.js (尺寸/格式處理) → products.js → images store
images store → useImageUrl.js → 暫時 Object URL → 畫面
```

Component 不直接操作 IndexedDB，圖片 URL 在不需要時釋放。名稱搜尋與分類篩選在記憶體中執行，避免每次輸入都發動 IndexedDB 查詢；對個人收藏量足夠，若未來達到數萬筆再考慮索引或分頁。分類由現有商品產生，因此 API/schema 變更主要集中在資料層；新增欄位需要更新表單與展示。新裝置型號目前不是產品需求，無需策略層。

## 隱私與網路

沒有 API server、登入、同步、追蹤或第三方資源。PWA 的 Service Worker 只快取建置產物；商品 CRUD 和查詢只讀寫 IndexedDB，不發出網路請求。初次載入或版本更新會向部署的靜態主機下載程式，部署商可能有一般存取日誌，但不會收到使用者輸入的商品資料。離線使用需先完成載入與快取。瀏覽器儲存並非永久保證，Phase 4 規劃可攜式備份與還原。

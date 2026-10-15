# GullStuff

GullStuff 是以繁體中文設計的個人商品資訊收藏工具。Phase 1 提供獨立的商品收藏，無帳號、無後端，資料與照片只存在目前瀏覽器的裝置儲存空間。

## 技術與執行

- Vue 3 Composition API + `<script setup>`、JavaScript、Vite
- Dexie 封裝 IndexedDB，透過 transaction 保存商品和圖片
- Vite PWA / Workbox 預先快取應用程式檔案，安裝或首次載入後可離線使用
- 無外部字型、圖片服務、分析 SDK 或雲端 API

需求：Node.js 20.19+ 或 22.12+，npm。

```bash
npm install
npm run dev
```

開啟終端輸出的本機網址。正式建置與預覽：

```bash
npm run build
npm run preview
```

自動測試：

```bash
npm test
```

可以將 `dist/` 部署到支援 HTTPS 的靜態網站。使用手機瀏覽器開啟後，可透過瀏覽器選單「加入主畫面」安裝。Service Worker 需要 HTTPS 或 localhost；首次載入需連網，之後快取完成才可離線開啟。部署路徑目前預設為網域根目錄 `/`。

## 已有功能

- 商品新增、列表、詳情、編輯、刪除確認
- 商品名稱必填；品牌、分類、型號與備註選填
- 依名稱搜尋、依分類篩選
- 從裝置選取照片，縮放成最長邊 1600 px 的 WebP，保存在 IndexedDB
- 圖片更換、移除及刪除商品時同步清理；遺失圖片顯示佔位圖
- 桌面與手機版響應式介面，空白、載入與錯誤狀態

初次安裝的收藏清單為空，不含示範商品。

## 專案結構

```text
src/App.vue                 畫面流程與商品操作
src/components/             商品卡片、編輯表單
src/composables/            本機圖片 URL 的生命週期
src/data/db.js              IndexedDB schema
src/data/products.js        商品儲存與查詢
src/data/image.js           圖片縮放
src/data/products.test.js   資料層自動測試
public/icon.svg             離線可用的圖示
docs/                       架構及 Roadmap
```

## 離線、隱私與限制

所有商品資料與圖片都存於目前裝置、目前瀏覽器的 IndexedDB；正常商品操作不會將資料送出。應用程式本身的初次下載與版本更新仍會向靜態主機請求程式檔案。不同瀏覽器、不同裝置各有獨立資料。

瀏覽器可能因儲存空間不足或系統政策清除資料；清除網站資料、移除應用程式或遺失裝置也可能造成永久遺失。Phase 1 尚無備份、還原或同步功能，請勿將此版本作為唯一重要資料保存處。照片最大 15 MB，轉換成 WebP 時動畫與部分中繼資料不會保留。SVG 等無法由瀏覽器解碼的影像會被拒絕。安裝體驗依瀏覽器而異。

地點清單、總覽與設定目前只有明確標示的規劃頁，尚未提供功能。

詳見 [架構說明](docs/architecture.md) 與 [開發路線](docs/roadmap.md)。

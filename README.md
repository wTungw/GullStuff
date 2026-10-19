# GullStuff

GullStuff 是以繁體中文設計的個人商品與地點收藏工具。無帳號、無後端，資料與照片只存在目前瀏覽器的裝置儲存空間。

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

行動端另可透過 Capacitor 包裝成 Android 原生應用（`appId` com.gullstuff.app，`webDir` 指向 `dist`），與桌面共用同一套資料層與介面。同步 Android 專案與開啟 Android Studio：

```bash
npm run cap:sync
npm run cap:open
```

建置 APK 需要 Java 與 Android SDK；Capacitor CLI 需 Node.js >= 22。桌面端仍以 PWA／瀏覽器為主。

## 已有功能

- 商品新增、列表、詳情、編輯、刪除確認與照片放大檢視
- 商品名稱必填且不可重複；品牌、分類、型號與備註選填
- 依名稱搜尋、依分類篩選
- 從裝置選取照片，縮放成最長邊 1600 px 的 WebP，保存在 IndexedDB
- 圖片更換、移除及刪除商品時同步清理；遺失圖片顯示佔位圖
- 桌面與手機版響應式介面，空白、載入與錯誤狀態
- 地點新增、列表、獨立唯讀詳情頁、編輯與刪除確認；詳情頁列出已連結商品及各組關聯的購買資訊，可記錄國家、城市、區域、地址與備註
- 地點頁使用與商品收藏一致的搜尋、地區篩選與列表版型；相同名稱、國家、城市／地區及地址的地點不可重複
- 新增或編輯地點時可搜尋並勾選已建立的商品，地點列表顯示連結數量
- 地點表單可直接新增商品，返回後保留地點草稿並自動勾選新商品
- 一個地點可連結多件商品；同一件商品也可連結多個地點，每組關聯只儲存一次
- 商品詳情顯示所有可購買地點；點選地點可查看詳情、取消連結或編輯地點；「連結地點」會先搜尋既有地點，找不到時才新增並預選此商品
- 可為每組商品與地點關聯分別記錄價格、幣別和購買備註；商品詳情的地點列表會顯示已記錄的價格
- 刪除地點時同步清理其商品關聯，保留商品本身
- 設定頁可匯出所有商品、地點、關聯與圖片為單一 `.gullstuff` 備份檔（含格式版本號），也能匯入還原；匯入會先驗證檔案與參照完整性，還原為取代式，會先清除目前的裝置資料再寫入
- 設定頁另可匯出 `.xlsx` Excel 表格，分為商品、地點與商品／地點關聯三個工作表，關聯表包含價格、幣別及購買備註；表格不含照片，不能當作還原備份

初次安裝的收藏清單為空，不含示範商品。

## 專案結構

```text
src/App.vue                 畫面流程與商品、地點操作
src/components/             商品卡片、編輯表單
src/composables/            本機圖片 URL 的生命週期
src/data/db.js              IndexedDB schema
src/data/products.js        商品儲存與查詢
src/data/locations.js       地點驗證、儲存與查詢
src/data/image.js           圖片縮放
src/data/backup.js          備份匯出、驗證與原子還原
src/data/products.test.js   資料層自動測試
src/platform/               備份檔案的 web／native 適配器
public/icon.svg             離線可用的圖示
capacitor.config.json       Capacitor 設定
android/                    Capacitor 產生的 Android 專案
docs/                       架構及 Roadmap
```

## 離線、隱私與限制

所有商品、地點資料與圖片都存於目前裝置、目前瀏覽器的 IndexedDB；正常收藏操作不會將資料送出。應用程式本身的初次下載與版本更新仍會向靜態主機請求程式檔案。不同瀏覽器、不同裝置各有獨立資料。

瀏覽器可能因儲存空間不足或系統政策清除資料；清除網站資料、移除應用程式或遺失裝置也可能造成資料遺失。目前提供本機備份與還原，可將資料匯出為 `.gullstuff` 檔另存或移轉裝置，但仍無雲端同步功能；建議定期匯出備份，不要只依賴單一瀏覽器作為唯一資料保存處。照片最大 15 MB，轉換成 WebP 時動畫與部分中繼資料不會保留。SVG 等無法由瀏覽器解碼的影像會被拒絕。安裝體驗依瀏覽器而異。

商品與地點之間可建立關聯、雙向查詢並記錄每組關聯的購買資訊；統計仍在後續階段。總覽目前仍是規劃頁；設定提供備份的匯出與還原。

詳見 [架構說明](docs/architecture.md) 與 [開發路線](docs/roadmap.md)。

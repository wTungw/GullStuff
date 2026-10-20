# GullStuff

GullStuff 是以繁體中文設計、以手機為主的商品、地點與群組收藏工具。無帳號、無後端；資料與照片保存在目前瀏覽器或 Android App 的本機儲存空間。

## 技術與執行

- Vue 3 Composition API + `<script setup>`、JavaScript、Vite
- Dexie 封裝 IndexedDB，透過 transaction 保存商品和圖片
- Vite PWA / Workbox 預先快取網站檔案；Android APK 內含網頁資源，兩者均可離線使用
- Capacitor 封裝 Android App，使用原生分享功能匯出備份
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

可以將 `dist/` 部署到支援 HTTPS 的靜態網站。使用手機瀏覽器開啟後，可透過瀏覽器選單「加入主畫面」安裝。Service Worker 需要 HTTPS 或 localhost；首次載入需連網，之後快取完成才可離線開啟。一般建置及 Android 封裝使用網域根目錄 `/`；若要放在 GitHub Pages 的 `/GullStuff/` 路徑，使用 `npm run build:pages`，並部署產生的 `dist/`。兩種建置會覆寫同一個 `dist/`，執行 `npm run cap:sync` 時會重新產生 Android 所需的根目錄版本。

Android App 使用 Capacitor（`appId` 為 `com.gullstuff.app`，`webDir` 指向 `dist`），與網站共用介面與資料層，但各自有獨立的本機資料。同步 Android 專案與開啟 Android Studio：

```bash
npm run cap:sync
npm run cap:open
```

建置 APK 需要 JDK 21、Android SDK，以及 Node.js 22 以上（供 Capacitor CLI 使用）：

```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```

測試用 APK 位於 `android/app/build/outputs/apk/debug/app-debug.apk`。這是由本機 Android debug 金鑰簽署的測試版本，不是正式發行版。APK 是建置產物，不納入 Git。

手機更新時，請直接安裝新版 APK 覆蓋舊版。必須維持相同的 `applicationId`、簽署金鑰，並提高 `android/app/build.gradle` 的 `versionCode`；符合條件時 Android 會保留 App 的本機資料。換電腦建置時若使用不同的 debug 金鑰，可能無法覆蓋安裝。解除安裝、清除 App 資料，或改用不同 App ID，都不會直接繼承資料，應先在設定頁匯出 `.gullstuff` 備份，安裝後再匯入。手機瀏覽器與 APK 的資料也不會自動互通。

## 已有功能

- 商品新增、列表、詳情、編輯、刪除確認與照片放大檢視
- 可建立群組、選擇圖示和顏色、調整商品順序；同一商品可放進多個群組
- 設定頁提供深色模式；選擇保存在目前 App／瀏覽器，重新開啟後仍會套用
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
- 設定頁可匯出所有商品、地點、群組、關聯與圖片為單一 `.gullstuff` 備份檔（含格式版本號），也能匯入還原；匯入會先驗證檔案與參照完整性，還原為取代式
- 設定頁另可匯出 `.xlsx` Excel 表格，包含商品、地點、群組三張工作表；商品列會顯示所屬群組，表格不含 ID、照片、地點關聯或購買價格，不能當作還原備份

初次安裝的收藏清單為空，不含示範商品。

## 專案結構

```text
src/App.vue                 商品、地點、群組與設定頁流程
src/components/             卡片、列表列與表單元件
src/composables/            圖片 URL 與深色模式狀態
src/theme.css               深色模式與外觀開關樣式
src/assets/                 App 原始品牌圖片
src/data/db.js              IndexedDB schema
src/data/products.js        商品儲存與查詢
src/data/locations.js       地點驗證、儲存與查詢
src/data/groups.js          群組與商品關聯
src/data/image.js           圖片縮放
src/data/backup.js          備份匯出、驗證與原子還原
src/data/spreadsheetExport.js Excel 工作表匯出
src/platform/               備份檔案的 web／native 適配器
public/icon-192.png         PWA 圖示（另有 512 px 版本）
capacitor.config.json       Capacitor 設定
android/                    Capacitor 產生的 Android 專案
docs/                       架構及 Roadmap
```

## 離線、隱私與限制

所有商品、地點、群組資料與圖片都存於目前瀏覽器或 Android App 的 IndexedDB；正常收藏操作不會將資料送出。網站首次載入與版本更新仍會向靜態主機請求程式檔案，APK 則內含離線資源。不同瀏覽器、APK 與不同裝置各有獨立資料。

瀏覽器可能因儲存空間不足或系統政策清除資料；清除網站資料、解除安裝 App 或遺失裝置也可能造成資料遺失。目前提供本機備份與還原，可將資料匯出為 `.gullstuff` 檔另存或移轉裝置，但沒有雲端同步；建議定期匯出備份，並將檔案存放在 App 以外的安全位置。深色模式偏好不包含在備份中。照片最大 15 MB，轉換成 WebP 時動畫與部分中繼資料不會保留。SVG 等無法由瀏覽器解碼的影像會被拒絕。安裝體驗依瀏覽器而異。

商品與地點之間可建立關聯、雙向查詢並記錄每組關聯的購買資訊。群組可像播放清單一樣收納與排序商品，同一商品可加入多個群組。設定提供含群組資料的備份、還原與 Excel 匯出。

詳見 [架構說明](docs/architecture.md) 與 [開發路線](docs/roadmap.md)。

# Angular 19 → 22 升級報告

日期：2026-07-18
基準文件：[UPGRADE_BASELINE.md](./UPGRADE_BASELINE.md)（升級前的完整功能與樣式記錄）

## 升級路徑（依 Angular 官方要求逐版執行）

| 步驟 | 指令 | 結果 |
|------|------|------|
| 19 → 20 | `ng update @angular/core@20 @angular/cli@20 @ng-bootstrap/ng-bootstrap@19` | 成功，無程式碼異動 |
| 20 → 21 | `ng update @angular/core@21 @angular/cli@21 @ng-bootstrap/ng-bootstrap@20` | 成功，官方強制 migration 將 `*ngIf`/`*ngFor` 轉為 `@if`/`@for`（語意等價） |
| 21 → 22 | `ng update @angular/core@22 @angular/cli@22 @ng-bootstrap/ng-bootstrap@21` | 成功，官方 migration 加上行為保留設定 |

## 最終版本

| 套件 | 升級前 | 升級後 |
|------|--------|--------|
| @angular/* | 19.2.x | 22.0.7 |
| @angular/cli | 19.2.15 | 22.0.7 |
| @angular-devkit/build-angular | 19.2.15 | 移除，改用 @angular/build 22.0.7 |
| @ng-bootstrap/ng-bootstrap | 18.0.0 | 21.0.0 |
| typescript | 5.7.2 | 6.0.3 |
| bootstrap | 5.3.7（lockfile） | 5.3.7（未變） |
| zone.js | 0.15.x | 0.15.x（未變，仍使用 Zone-based 變更偵測） |
| less | （由 build-angular 內含） | 4.6.7（明確加入 devDependencies） |

## 程式碼異動內容（全部為官方 migration 或行為保留型修改）

1. **Control Flow 語法轉換**（v21 強制 migration，官方保證語意等價）：
   所有範本的 `*ngIf` → `@if`、`*ngFor` → `@for (…; track …)`；`track` 使用與原 `*ngFor` 預設相同的物件 identity 追蹤。不再需要的 `CommonModule` 匯入由 migration 自動移除（僅在確認範本未使用其管道/指令時）。
2. **`ChangeDetectionStrategy.Eager` 明確標註**（v22 migration）：
   v22 起新元件預設改變，此標註讓所有既有元件**維持 v21 以前的變更偵測行為**。
3. **`provideHttpClient(withXhr())`**（v22 migration）：維持既有 XHR 後端行為。
4. **tsconfig 加入 `nullishCoalescingNotNullable`/`optionalChainNotNullable` 診斷抑制**（v22 migration）：維持既有編譯行為。
5. **angular.json**：
   - builder 由 `@angular-devkit/build-angular:*` 改為 `@angular/build:*`（同一 esbuild builder 的新套件位置，**輸出 byte-identical**），修正 dev-server 棄用警告。
   - 加入 schematics 產生器預設值（僅影響未來 `ng generate`，不影響既有程式）。
6. **package.json**：加入 `overrides` 將 vite 內嵌 esbuild 升至 0.28.1（修正安全性弱點）；migration 自動加入 `istanbul-lib-instrument`。

**未執行**的選擇性 migration（避免不必要的變動）：`use-application-builder`（本專案原本就使用 application builder）、`migrate-karma-to-vitest`、`router-current-navigation`。

## 警告修正結果

| 警告 | 狀態 |
|------|------|
| 建置時「4 rules skipped due to selector errors」（Bootstrap CSS） | ✅ 已消失（新版 esbuild 可正確解析該語法，且這 4 條規則的類別本專案未使用） |
| `ng serve`「@angular-devkit/build-angular:dev-server builder is deprecated」 | ✅ 改用 `@angular/build` 修正 |
| `npm audit` 13 個弱點（karma 工具鏈 tmp/ws/socket.io、vite 內嵌 esbuild） | ✅ 0 vulnerabilities |
| production/development 建置、npm install | ✅ 全程零警告 |

## 功能與樣式無異動之驗證

1. **樣式（CSS）**：升級前後 production `styles.css` 經空白正規化後逐規則比對，**2644 條規則 100% 一致（0 差異）**；唯一文字差異為 minifier 的 `@media (` → `@media(` 空白移除，無語意影響。
2. **建置輸出**：三個 bundle（main/styles/polyfills）皆正常產出；builder 切換前後輸出檔 hash 完全相同。
3. **啟動冒煙測試**：`ng serve` 啟動成功，`/`、`main.js`、`styles.css`、`assets/data/months.json` 皆回應 HTTP 200。
4. **行為保留**：Hash 路由、base-href、GTM、loading 畫面、zone.js 變更偵測、Eager 變更偵測策略皆未改變；未採用 zoneless、未改用新的預設變更偵測。

## 建議的後續人工回歸重點（部署前）

- 四個 Dialog（主題詳情、新增單字、JSON 設定、儲存設定）的開啟/關閉、全螢幕、backdrop 行為（ng-bootstrap 18 → 21 跨了三個主版本）。
- 主題詳情內的選字加入生字簿（雙擊/右鍵/長按）與選單 z-index 是否仍壓在 modal 之上。
- Android 實體返回鍵關閉 Dialog 的行為。
- 學習狀態記憶、LocalStorage ↔ IndexedDB 切換遷移。

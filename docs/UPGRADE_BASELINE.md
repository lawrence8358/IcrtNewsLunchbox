# ICRT News Lunchbox — Angular 19 升級前基準文件（UPGRADE BASELINE）

> 建立日期：2026-07-18
> 目的：作為 Angular 19 → Angular 22 升級前的功能、樣式與建置基準。升級後所有行為必須與本文件描述一致。

---

## 1. 版本資訊

### 1.1 專案基本資料

| 項目 | 值 |
|---|---|
| 專案名稱 | `icrt-news-lunchbox`（angular.json 專案名：`IcrtNewsLunchbox`） |
| homepage | `https://lawrence8358.github.io/IcrtNewsLunchbox` |
| 版本 | 1.0.0 |
| 架構 | Angular 19 Standalone（無 NgModule），`bootstrapApplication` 啟動 |
| 樣式語言 | LESS（`inlineStyleLanguage: less`，schematics 預設 `style: less`） |
| 建置 builder | `@angular-devkit/build-angular:application` |

### 1.2 dependencies（package.json 抄錄）

| 套件 | 版本 |
|---|---|
| @angular/common | ^19.2.0 |
| @angular/compiler | ^19.2.0 |
| @angular/core | ^19.2.0 |
| @angular/forms | ^19.2.0 |
| @angular/platform-browser | ^19.2.0 |
| @angular/platform-browser-dynamic | ^19.2.0 |
| @angular/router | ^19.2.0 |
| @ng-bootstrap/ng-bootstrap | ^18.0.0 |
| @popperjs/core | ^2.11.8 |
| bootstrap | ^5.3.3 |
| gh-pages | ^6.3.0 |
| rxjs | ~7.8.0 |
| tslib | ^2.3.0 |
| zone.js | ~0.15.0 |

### 1.3 devDependencies

| 套件 | 版本 |
|---|---|
| @angular-devkit/build-angular | ^19.2.15 |
| @angular/cli | ^19.2.15 |
| @angular/compiler-cli | ^19.2.0 |
| @angular/localize | ^19.2.0 |
| @types/jasmine | ~5.1.0 |
| jasmine-core | ~5.6.0 |
| karma | ~6.4.0 |
| karma-chrome-launcher | ~3.2.0 |
| karma-coverage | ~2.2.0 |
| karma-jasmine | ~5.1.0 |
| karma-jasmine-html-reporter | ~2.1.0 |
| typescript | ~5.7.2 |

### 1.4 建置指令（package.json scripts）

| 指令 | 內容 |
|---|---|
| `npm start` | `ng serve` |
| `npm run build` | `ng build --base-href=/IcrtNewsLunchbox/` |
| `npm run watch` | `ng build --watch --configuration development` |
| `npm test` | `ng test`（Karma + Jasmine） |
| `npm run deploy` | `gh-pages -d dist/browser` |
| `npm run cicd` | `npm run build && npm run deploy` |

### 1.5 angular.json 重點設定

- `outputPath: dist`、`browser: src/main.ts`、`index: src/index.html`
- polyfills：`zone.js` + `@angular/localize/init`（test 另加 `zone.js/testing`）
- assets：`public/` 整個目錄（`{ glob: "**/*", input: "public" }`）
- styles 順序：`node_modules/bootstrap/dist/css/bootstrap.min.css` → `src/styles.less`
- production budgets：initial 警告 800kB / 錯誤 1.2MB；anyComponentStyle 警告 12kB / 錯誤 20kB
- `outputHashing: all`（production）、`defaultConfiguration: production`

### 1.6 應用程式啟動流程（app.config.ts / main.ts）

- `bootstrapApplication(AppComponent, appConfig)`
- providers：
  - `provideZoneChangeDetection({ eventCoalescing: true })`
  - `provideRouter(routes, withHashLocation())` — **Hash 路由**
  - `provideHttpClient()`
  - `provideAppInitializer(...)` → 呼叫 `AppInitializerService.initialize()`（並行載入 months.json、tag.json）

---

## 2. 路由與頁面

路由定義於 `src/app/app.routes.ts`，使用 **Hash 路由**（`withHashLocation()`），網址形如 `/#/home`。

| 路由 | 元件 | 用途 |
|---|---|---|
| `''` | redirect → `/home`（pathMatch: full） | 預設導向 |
| `/home` | `HomeComponent`（pages/home） | 主頁：月份/程度/標籤/學習狀態/文字搜尋，主題卡片列表，點卡片開啟主題詳情 dialog |
| `/vocabulary-book` | `VocabularyBookComponent`（pages/vocabulary-book） | 生字簿：熟悉度篩選、搜尋、匯出/匯入/貼上 JSON、新增單字、儲存引擎設定 |
| `/vocabulary-quiz` | `VocabularyQuizComponent`（pages/vocabulary-quiz） | 生字測驗：設定 → 進行 → 結果三階段 |
| `**` | redirect → `/home` | 萬用路由 |

外框（`AppComponent`）提供：Header（漸層標題列）、置中導覽列（主頁/生字簿/測驗，`routerLinkActive`）、`<router-outlet />`、Footer（版權聲明）、右上角通知容器。

---

## 3. 功能清單（升級驗收基準）

### 3.1 AppComponent（src/app/app.component.ts）

- 訂閱 `NotificationService.getMessages()`，以 `*ngFor` 渲染右上角通知（依 type 顯示不同圖示/邊框色），可點 X 移除。
- `ngAfterViewInit` 啟動輪詢（每 100ms `setTimeout`）檢查 `SettingConfig.isInitialized`；為 true 後對 `#app-loading` 加上 `.fade-out` class（0.5s 淡出），500ms 後 `remove()` 該 DOM 元素。**loading 淡出行為是驗收條件。**
- `getNotificationIcon(type)`：success/error/warning/info → 對應 Font Awesome 圖示。

### 3.2 頁面

#### 3.2.1 HomeComponent（pages/home）

- **初始化**：讀取 localStorage `icrt_settings`（AppSettings：lastMonth/lastSearch/lastType/lastTag/lastLearningStatus），從 `SettingConfig` 取 months/tags；若有記憶的月份且存在於清單中則還原全部篩選條件並自動載入該月資料。
- **查詢列**（6 欄，`col-md-2`）：月份下拉（`formatMonthLabel` 顯示 `YYYY年MM月`）、程度下拉（由當月資料動態 `getUniqueTypes()`）、標籤下拉（tag.json）、學習狀態下拉（全部/未進行/學習中/已學習）、文字搜尋（Enter 可觸發）、搜尋按鈕（搜尋中 disabled 並顯示「搜尋中...」）。
- **搜尋**：`performSearch()` 未選月份時顯示錯誤通知「請選擇月份」；否則儲存設定到 `icrt_settings` 後載入月份資料。
- **載入月份資料**：`DataService.loadMonthData(month)` → 套用 `LearningStatusService.applyLearningStatusToTopics()`（把 localStorage 的學習狀態合併進 topic）→ `FilterService.filterTopics()` 過濾。
- **主題卡片**：顯示 type 徽章、學習狀態徽章（未進行=灰圓點 / 學習中=黃色播放圖示帶 pulse 動畫 / 已學習=綠色勾）、日期（`YYYY-MM-DD(週X)`）、tag 徽章、標題、內容第一段英文前 100 字預覽。
- **點擊卡片**：以 `NgbModal.open(TopicDetailDialogComponent, { backdrop: 'static', scrollable: true, fullscreen: true })` 開啟，傳入 `componentInstance.topic`。
- **queryParams**：`?openTopic=<topicId>` 會在目前已載入資料中尋找並開啟該主題，找不到顯示「找不到指定的主題」。
- 狀態畫面：isLoading / isSearching spinner、「請選擇月份開始」空狀態、「找不到相關主題」無結果狀態。

#### 3.2.2 VocabularyBookComponent（pages/vocabulary-book）

- 訂閱 `VocabularyService.getVocabularyData()`，本地套用篩選：熟悉度（null=全部 / 1 / 2 / 3，`[ngValue]`）＋文字搜尋（比對 word / translation / phonetic，即時 `(input)`）。
- 功能按鈕列：
  - **儲存設定**（`isDebug = true` 才顯示）→ 開 `StorageSettingsDialogComponent`（`size: 'xl'`, `windowClass: 'full-modal-dialog'`, backdrop static, scrollable）。
  - **匯出**：`VocabularyService.exportData()` → Blob 下載 `vocabulary_YYYY-MM-DD.json`（格式 `{ vocabulary, version: '2.0', exportDate }`），成功通知「生字簿已匯出」。
  - **匯入**：隱藏 `<input type="file" accept=".json">`（`@ViewChild('fileInput')`），讀檔 JSON.parse 後 `importData()`；失敗通知「匯入失敗：檔案格式不正確」。
  - **貼上 JSON** → 開 `JsonSettingsDialogComponent`（fullscreen）。
  - **新增單字** → 開 `AddWordDialogComponent`（fullscreen）。
- 生字清單以共用 `<app-vocabulary-list>` 呈現（傳入 externalVocabularyData / externalFilteredVocabulary / openTopic 回呼）。
- `openTopic(topicId)`：**逐月**呼叫 `DataService.loadMonthData()` 搜尋該 topicId，找到後開啟 TopicDetailDialog（fullscreen）；找不到通知「找不到指定的主題」。

#### 3.2.3 VocabularyQuizComponent（pages/vocabulary-quiz）

三階段（`QuizState`：setup / in-progress / completed），狀態由 `VocabularyQuizService` 的 BehaviorSubject 驅動：

- **設定階段**：熟悉度 checkbox（不熟/尚可/記住了，預設全選）、題目數量（number input，min 1 max 100，預設 10）、顯示「符合條件生字數」與「實際出題數」（`min(設定題數, 可用生字數)`）；0 個生字時開始按鈕 disabled 並顯示警告 alert；「重置設定」還原預設並存檔。
- **進行階段**：進度條（第 N 題/共 M 題 + 百分比）、題目卡（顯示熟悉度徽章、中文翻譯以 `[innerHTML]` 換行渲染）、答案輸入（Enter 或按鈕送出、答過即 disabled）、答對/答錯即時回饋與正確答案顯示、上一題/下一題/完成測驗（需全部作答）/離開測驗（`confirm()` 確認）、題目指示器格（current/correct/incorrect 顏色，可點擊跳題）。
- **結果階段**：分數圓圈（依百分比 excellent≥90 / good≥70 / average≥50 / poor 分級配色）、正確率、測驗時間（`X分Y秒`）、逐題詳細結果（含答錯者顯示你的答案）、每題可調整熟悉度下拉、「儲存所有熟悉度變更」（逐一 `VocabularyService.addWord()` 更新，通知更新數量）、「重新測驗」。

### 3.3 Dialog 元件（皆為 ng-bootstrap Modal）

#### 3.3.1 TopicDetailDialogComponent（components/topic-detail-dialog）

開啟方式：fullscreen、backdrop static、scrollable。`@Input() topic`、`@ViewChild('audioPlayer')`。

- **音訊播放**：topic.audio 存在時顯示原生 `<audio controls>`（src 於 `setTimeout` 中設定）；各內容/單字/測驗項目若有 `time` 顯示「跳到時間點」播放鈕（`UtilsService.parseTimeToSeconds` 支援 `分:秒`、`時:分:秒`、純秒數）與播放中顯示暫停鈕；`close()` 時停止並歸零。
- **四個 Tab**（content / vocabulary / quiz / my-vocabulary，自製 tab，非 ngb-nav）：
  - 內容：每段英文＋可切換顯示中文翻譯（預設隱藏，`.chinese-text.show` 才顯示）。
  - 單字：preface、單字列表（`\n` 轉 `<br>` 以 `[innerHTML]` 呈現）、postscript。
  - 測驗：題目、選項、「顯示答案/隱藏答案」切換。
  - 生字簿：`<app-vocabulary-list [topicId]="topic.id" [showActions]="false">`（只顯示該篇來源的生字）。
- **學習狀態**：下拉（未進行/學習中/已學習），變更即透過 `LearningStatusService.saveLearningStatus()` 寫入 localStorage `icrt_learning_status`。**學習狀態記憶是驗收條件。**
- **選字加入生字簿**（核心互動，全部在 document 層級掛全域事件、僅處理 `.modal-body` 內的目標）：
  - 雙擊：用 `document.caretRangeFromPoint`（Firefox fallback `caretPositionFromPoint`，再 fallback 字寬估算）自動選取整個單字並彈出「加入生字簿」選單。
  - 右鍵（contextmenu）：有選取含英文文字時 `preventDefault` 並彈出選單。
  - 觸控長按 800ms：觸發（支援 `navigator.vibrate(50)` 振動回饋）彈出選單。
  - 選單位置依選取範圍 rect 計算並防超出視窗；10 秒後自動隱藏；overlay 點擊背景關閉並清除選取。
  - 來源區域識別：`data-source="content|vocabulary|quiz"` + `data-content-index` / `data-vocab-index` / `data-quiz-index` 屬性。
  - 確認後開啟 `AddWordDialogComponent`（fullscreen），以 `setNewWordData(text, { title, topicId, section: '<type> #<index>' })` 帶入。
- **使用說明**：頂部 alert 提示（雙擊/右鍵/長按），可展開詳細說明（注意：模板有 `[@slideInOut]` 動畫綁定，但元件**未宣告** animations，目前能運作是因為未觸發編譯錯誤的寬鬆情境，升級時需留意）。
- **Android back 鍵**：`AndroidBackButtonService.setupBackButtonHandler(activeModal)`，返回鍵只關 dialog 不退頁面。**驗收條件。**
- `ngOnDestroy` / `close()` 均會移除所有 document 事件與計時器。

#### 3.3.2 AddWordDialogComponent（components/add-word-dialog）

- 兩種模式：新增（`setNewWordData`）與編輯（`setEditData`）。
- 欄位：單字（必填）、英標、中文翻譯（textarea）、熟悉度（必填，key：unknown/fair/known ↔ level 1/2/3）、來源文章徽章（可逐一移除）。
- 新增模式輸入單字時（`(change)`）即時查 `findWordByText`，若已存在自動帶入既有英標/翻譯/熟悉度並**合併來源**（以 topicId+title 去重）。
- 編輯模式改單字文字撞到其他既有單字時，`confirm()` 詢問是否合併：合併則沿用既有 ID、合併來源並刪除原單字；取消則中止（throw '使用者取消操作'，不顯示錯誤）。
- 驗證失敗：欄位標紅（`is-invalid`）、滾動聚焦到第一個錯誤欄位、通知「請填寫必要欄位」。
- 儲存成功通知「已將「X」加入生字簿」或「已更新「X」」，`activeModal.close(word)`。
- 編輯模式有刪除按鈕（`confirm()` 後刪除，通知「單字已刪除」，close `{ deleted: true }`）。
- Android back 鍵：同樣透過 `AndroidBackButtonService`。

#### 3.3.3 JsonSettingsDialogComponent（components/json-settings-dialog）

- 開啟時 `VocabularyService.initialize()` 後把目前生字簿 JSON.stringify(空 2 格) 填入 textarea。
- 即時驗證：必須是陣列、每項必須含 id/word/level、level 必須是 1/2/3；顯示有效/無效徽章、錯誤訊息、行數/字符數統計。
- 工具列：格式化、壓縮、清空（`confirm()`）。
- 儲存：`importData()`（整份覆蓋），通知「已成功更新 N 個單字」，close `{ updated: true }`。
- Android back 鍵：自行實作 popstate 處理（`history.pushState(null, '')` + `handlePopState`：`event.state` 存在才 dismiss，否則重新 push）。
- 自帶暗色主題支援（`@media (prefers-color-scheme: dark)` 調整 textarea 配色）。

#### 3.3.4 StorageSettingsDialogComponent（components/storage-settings-dialog）

- Radio 選 LocalStorage / IndexedDB（不支援 IndexedDB 時該選項 disabled + 警告，並自動退回 localStorage）。
- 顯示目前儲存方式徽章。
- 儲存：`VocabularyService.switchStorageEngine()`（含資料搬遷），成功通知「儲存設定已更新，資料已遷移」，close(true)。
- Android back 鍵：自行實作 popstate（pushState 後 popstate 即 dismiss）。
- 注意：此 dialog 的 `.component.less` 是**空檔案**。

### 3.4 VocabularyListComponent（components/vocabulary-list，共用元件）

- `@Input()`：`topicId`（有值時只顯示 sources 含該 topicId 的生字）、`showActions`、`containerClass`、`openTopic` 回呼、`externalVocabularyData` / `externalFilteredVocabulary`（有外部資料時直接採用，`ngOnChanges` 同步；否則自行訂閱 VocabularyService 載入）。
- 每張生字卡：單字＋**發音鈕**（Web Speech API `speechSynthesis`，en-US、rate 0.8、優先挑英文 voice、處理 voices 未載入時的 `onvoiceschanged`、不支援時警告通知）、翻譯顯示切換（eye/eye-slash）、**編輯鈕**（開 AddWordDialog fullscreen + `setEditData`）、熟悉度徽章文字、英標、翻譯（`\n`→`<br>` 以 `[innerHTML]`）、來源文章 tag（點擊呼叫 `openTopic` 回呼）。
- 卡片左邊框依 level 變色：1 不熟=紅 #dc3545、2 尚可=黃 #ffc107、3 記住了=綠 #28a745。
- 空狀態文案依 `topicId` 有無而不同；載入中 spinner。

### 3.5 Services

#### 3.5.1 AppInitializerService（app-initializer.service.ts）

- 由 `provideAppInitializer` 呼叫。`forkJoin` 並行 GET：
  - `assets/data/months.json` → `SettingConfig._setMonths()`
  - `assets/data/tag.json` → `SettingConfig._setTags()`
- URL 一律附加防快取參數 `SettingConfig.randomParam`（`?v=<timestamp>&r=<random>`，App 啟動時產生一次）。
- 任一失敗均 catch 後回空陣列，且**無論成敗都 `_setInitialized(true)` 並 resolve**（避免 App 卡在 loading）。

#### 3.5.2 DataService（data.service.ts）

- `loadMonthData(month)`：GET `assets/data/<YYYYMM>.json`（month 去掉 `-`）+ 防快取參數，回傳 `Topic[]` 並依 `topic.id` **降冪排序**；失敗回空陣列。
- `getAllBaseData()`：從 SettingConfig 取 months/tags。
- `loadSettings()` / `saveSettings()`：localStorage key **`icrt_settings`**（AppSettings）；無存檔時預設 `lastMonth = 當前 YYYYMM`。
- `getCurrentMonth()`：回傳 `YYYYMM`。

#### 3.5.3 FilterService（filter.service.ts）

- `filterTopics(topics, searchText, selectedType, selectedTag, selectedLearningStatus?)`：
  - 文字搜尋範圍：title、type、tag、content（en+tw）、vocabulary.content[].text（皆不分大小寫）。
  - type 精確比對；tag 為 includes；學習狀態比對（topic 無狀態視為 `not-started`）。
- `sortTopicsByDate()`：由 id 前 8 碼日期新→舊。
- `getUniqueTypes()`：去重排序後的 type 清單。

#### 3.5.4 LearningStatusService（learning-status.service.ts）

- localStorage key **`icrt_learning_status`**，格式 `{ [topicId]: 'learned' | 'learning' | 'not-started' }`。
- `loadLearningStatuses` / `saveLearningStatus` / `getLearningStatus`（預設 `not-started`）/ `applyLearningStatusToTopics`（合併進 Topic）/ `removeLearningStatus` / `clearAllLearningStatuses`。

#### 3.5.5 NotificationService（notification.service.ts）

- `BehaviorSubject<NotificationMessage[]>`，`showSuccess`(3s)/`showError`(5s)/`showInfo`(3s)/`showWarning`(4s)，id 為 `msg_<遞增>`，duration 後自動移除；`removeMessage` / `clearAll`。

#### 3.5.6 UtilsService（utils.service.ts）

- `formatDateWithWeekday('YYYY-MM-DD')` → `YYYY-MM-DD(週X中文)`。
- `formatMonthLabel('YYYYMM')` → `YYYY年MM月`。
- `formatDateFromId('YYYYMMDD-xx')` → 帶星期的日期。
- `parseTimeToSeconds('m:s' | 'h:m:s' | '30' | number)` → 秒數。
- `truncateText`、`extractMonthFromTopicId`。

#### 3.5.7 VocabularyService（vocabulary.service.ts，生字簿核心）

- **雙儲存引擎**：IndexedDB（DB 名 `VocabularyBookDB` v1，store `vocabulary`，keyPath `id`，index word/level）或 localStorage。
  - 引擎選擇記錄在 localStorage key **`vocabulary_storage_type`**（值 `'indexeddb'` / `'localstorage'`）；首次啟動預設 IndexedDB（若支援）。
  - localStorage 資料 key：**`vocabulary_book`**（JSON 陣列）。
- constructor 內 `setTimeout(0)` 非同步載入資料，推送到 `vocabularyData$` / `filteredData$`（BehaviorSubject）。
- **排序規則**：level 升冪（1 不熟在最上）→ 同 level 依單字字母序（不分大小寫）。存檔與過濾後都會重新排序。
- `addWord()`：先以 id 找（編輯更新，保留 createdAt）、否則以文字不分大小寫找（覆蓋但保留原 id/createdAt）、否則全新（自動產生 id：`Date.now().toString(36)+random`，設 createdAt/updatedAt）。
- `deleteWord(id)`、`applyFilter({search, level})`（比對 word/translation）。
- `switchStorageEngine(useIndexedDB)`：先存記憶體資料到當前引擎 → 讀出 → 切換設定 → 寫入新引擎 → **清空舊引擎資料** → 重載。
- `exportData()`（version '2.0'）/ `importData()`（驗證 vocabulary 為陣列後整份覆蓋）。
- `getStorageStatus()` / `getStorageType()` / `findWordByText()` / `getAllWords()` / `initialize()`。

#### 3.5.8 VocabularyQuizService（vocabulary-quiz.service.ts）

- localStorage key **`vocabulary_quiz_settings`**（`{ selectedLevels: number[], questionCount: number }`，預設 `[1,2,3]` / 10）。
- 狀態流：quizState$ / questions$ / questionIndex$ / quizResult$（BehaviorSubject）。
- `startQuiz()`：篩選符合 level 的生字 → Fisher-Yates 洗牌 → 取 `min(題數, 可用數)` 題 → 進入 IN_PROGRESS；無生字回 false。
- `submitAnswer()`：trim 後不分大小寫比對整個單字。
- `completeQuiz()`：計算 correctAnswers、score（百分比四捨五入）、duration（ms）。
- `nextQuestion` / `previousQuestion` / `goToQuestion` / `updateQuestionLevel` / `applyLevelChanges`（把 newLevel≠originalLevel 的題目寫回生字簿）/ `resetQuiz`。

#### 3.5.9 AndroidBackButtonService（android-back-button.service.ts）

- `setupBackButtonHandler(activeModal, confirmCallback?)`：開 dialog 時 `history.pushState({modalOpen:true})`；popstate 時立即再 pushState 防止真的返回，然後（經 confirmCallback 同意後）`activeModal.dismiss()`；回傳 cleanup 函式移除監聽。**Android 實體返回鍵=關閉 dialog、不離開頁面，是驗收條件。**

#### 3.5.10 WordSelectionService（word-selection.service.ts）

- 提供文字選取狀態流（selectedText$、context menu 顯示/位置）、`isValidWord`（`^[a-zA-Z]([a-zA-Z\-']*[a-zA-Z])?$`、長度≥2）、選單位置邊界調整、`bindWordSelectionEvents` / `unbindWordSelectionEvents`。
- **注意**：目前 TopicDetailDialog 內選字邏輯是自行實作，此 service 未被任何元件 import（屬備用/遺留程式碼），升級時保留即可。

#### 3.5.11 SettingConfig（config/setting.config.ts，靜態設定類）

- 靜態存放 months、tags、isInitialized、randomParam（App 生命週期內固定的防快取字串）。
- AppComponent 的 loading 移除輪詢依賴 `SettingConfig.isInitialized`。

### 3.6 資料模型

- `Topic`：id（`YYYYMMDD-nn`）、type（國小/國中等）、tag[]、title、audio（ICRT mp3 完整 URL）、content[]（en/tw/time）、vocabulary（preface/content[text,time]/postscript）、quiz[]（question/options/answer/time）、learningStatus?。
- `VocabularyWord`：id、word、phonetic?、translation、partOfSpeech?、level（1/2/3）、sources[]（title/topicId/section?）、createdAt、updatedAt。
- `VOCABULARY_LEVELS`：1=不熟（bg-danger/unknown）、2=尚可（bg-warning/fair）、3=記住了（bg-success/known），含 `VocabularyLevelUtils` 轉換工具。
- `QuizState` enum：setup / in-progress / completed。

### 3.7 localStorage / IndexedDB Key 總表（升級後不得變動）

| Key | 用途 | 寫入者 |
|---|---|---|
| `icrt_settings` | 主頁查詢條件記憶（AppSettings） | HomeComponent / DataService |
| `icrt_learning_status` | 主題學習狀態 `{topicId: status}` | LearningStatusService |
| `vocabulary_storage_type` | 生字簿儲存引擎（'indexeddb'/'localstorage'） | VocabularyService |
| `vocabulary_book` | 生字簿資料（localStorage 引擎時） | VocabularyService |
| `vocabulary_quiz_settings` | 測驗設定 | VocabularyQuizService |
| IndexedDB `VocabularyBookDB` v1 / store `vocabulary` | 生字簿資料（IndexedDB 引擎時） | VocabularyService |

### 3.8 HTTP 資料來源（GitHub Pages 靜態 JSON，皆附防快取 query）

| 路徑 | 內容 |
|---|---|
| `assets/data/months.json` | 月份清單（如 `["202302", ..., "202506"]`，目前 13 個月份） |
| `assets/data/tag.json` | 標籤清單（字串陣列） |
| `assets/data/<YYYYMM>.json` | 該月主題陣列（Topic[]） |

`public/` 內容：`favicon.ico` + `assets/data/*.json`（months.json、tag.json、202302~202506 共 13 個月份檔）。音訊為 `topic.audio` 指向的 ICRT 外部 mp3 URL。

---

## 4. 樣式基準

### 4.1 全域樣式來源與載入順序

1. `bootstrap.min.css`（Bootstrap **5.3.3**，angular.json styles 第一位）
2. `src/styles.less`（匯入 `src/styles/variables.less`）
3. 各元件 `.less`（View Encapsulation 內）
4. `src/index.html` 內嵌的 loading `<style>`
5. ng-bootstrap **18**：提供 NgbModal（本專案 modal 全數使用）

### 4.2 variables.less 色彩/變數重點

- 主題色：`@primary-color: #2E86AB`（藍）、`@secondary-color: #A23B72`（紫紅）、`@accent-color: #F18F01`（橘）、`@background-color: #F4F7F9`。
- 狀態色：danger #dc3545、warning #ffc107、success #28a745、info #17a2b8。
- 文字色：#333 / #495057 / #6c757d；背景 #f8f9fa；邊框 #dee2e6。
- 熟悉度色（badge 用）：familiarity-1 #f8d7da/#721c24、-2 #fff3cd/#856404、-3 #d1ecf1/#0c5460（另定義 4、5 備用）。
- 測驗結果色：success-bg #d4edda、error-bg #f8d7da、info-bg #d1ecf1、warning-bg #fff3cd。
- z-index：modal 1050、通知容器 1070、**選字選單 10060 / overlay 10059（必須壓在 modal 之上）**。
- 響應式斷點變數：576 / 768 / 992 / 1200 / 1400px（實際 media query 主要用 576px、768px、400px）。
- 注意 `@success-color`、`@warning-color` 等在 variables.less 後段被「測驗相關色彩」**重新定義覆蓋**（如 @success-color 最終為 #155724），LESS 變數採最後定義生效——升級或重構樣式時不可改變此順序。

### 4.3 styles.less（全域）重點

- 字型：`body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }`，flex column、min-height 100vh，背景 @background-color。
- 通知系統：`.notification-container` fixed 右上（top/right 20px、寬 350px、max-width 90vw、z-index 1070）；`.notification` 白底、左 4px 色條、`slideInRight` 0.3s 進場動畫。
- Header：`linear-gradient(135deg, @primary-color, @secondary-color)`，標題強制單行 ellipsis。
- `.filter-section` / `.topic-card` / `.vocabulary-word-card`：白底圓角 10px 卡片、hover 上移 2px + 加深陰影。
- `.topic-type`（橘）、`.topic-date`（灰）、`.topic-tag`（藍）圓角膠囊徽章。
- `.btn-primary` 覆寫為 @primary-color，hover 變 @secondary-color。
- `.main-nav-tabs .nav-link.active`：#0d6efd、粗體、2.5px 底線。
- 選字選單 `.word-selection-context-menu`：fixed、z-index 10060、全部 `!important`；`.context-menu-overlay` 透明全螢幕 z-index 10059。
- `.modal-header`：主題漸層底、白字、sticky top、z-index 1055；`.btn-close-white` filter 反白。
- `.content-item .chinese-text` 預設 `display:none`（配合元件 `.show` 顯示）。
- Footer：主題漸層、`.footer-link` 橘色。
- 共用圓形圖示按鈕：`.btn-vocabulary-action` / `.btn-jump-time` / `.btn-pause-time` / `.btn-toggle-translation`（2rem 圓形，發音/跳時間=藍、翻譯/暫停=紫紅、編輯=綠，hover 反白 + scale(1.1)）。
- **RWD**：
  - `@media (max-width: 576px)`：header 標題縮至 1.1rem、卡片 margin 縮為 0.5rem、tag 字縮小、nav padding 縮小、footer 縮小。
  - `@media (max-width: 400px)`：header 再縮（0.9rem、padding 0.5rem 0）。

### 4.4 元件樣式重點（含手機版斷點）

- **app.component.less**：`.app-container` flex column min-height 100vh；`.main-content` flex:1、`min-height: calc(100vh - 120px)`；內含 `:global { ... }` 區塊（覆寫 .btn/.form-control/.card/.modal-content 圓角陰影——注意 `:global` 非 Angular 標準機制，實際會被編譯為 `:global` 選擇器並套上 encapsulation attribute，升級後行為必須維持不變，不要「順手修正」）。
- **home.component.less**：`.topic-learning-status` 三態徽章（not-started 灰漸層 / learning 黃漸層＋icon pulse 動畫 / learned 綠漸層）；576px 以下 `.topic-meta` 子元素統一 0.8rem、icon 0.7rem、gap 0.4rem；`.topic-meta .topic-type { margin-bottom: 0 }`。
- **vocabulary-book.component.less**：`:host::ng-deep #vocabularyList` padding 1rem（576px 以下 0.5rem）——**使用了 `::ng-deep`（已棄用 API）**。
- **vocabulary-quiz.component.less**：容器 max-width 800px 置中；familiarity 徽章配色；題目指示器 40x40；分數圓圈 120px 四級配色；768px 以下：容器 padding 縮小、答案輸入改直排、操作按鈕滿寬直排、結果摘要改直排置中。另使用 `:has(i.fa-check)` / `:has(i.fa-times)` CSS 選擇器為結果徽章配色（依賴瀏覽器 `:has()` 支援）。
- **topic-detail-dialog.component.less**：modal 標題單行 ellipsis（`max-width: calc(100vw - 100px)`）；自製 nav-tabs 底線式 tab；content/vocabulary/quiz 卡片（vocabulary 左框橘色）；quiz 選項 hover 淡藍；`.learning-status-section` 灰底圓角卡。RWD：768px 以下 topic-meta 保持橫排不換行、控制按鈕縮至 1.8rem、quiz-header 改直排；576px 以下 vocabulary 卡 margin/padding 縮小、學習狀態區改直排滿寬。
- **vocabulary-list.component.less**：`:host` 包裹全部；生字卡左框依 level 變色；576px 以下卡片 margin 0.5rem 0、padding 0.8rem、單字字級 1rem。
- **add-word-dialog.component.less**：僅 `:host { height: 100% }`。
- **json-settings-dialog.component.less**：textarea 聚焦黃框（#ffc107）；含 `@media (prefers-color-scheme: dark)` 暗色支援。
- **storage-settings-dialog.component.less**：空檔案。

### 4.5 ng-bootstrap Modal 使用方式（全部沿用不可變）

| Dialog | 開啟選項 |
|---|---|
| TopicDetailDialog | `{ backdrop: 'static', scrollable: true, fullscreen: true }` |
| AddWordDialog | `{ backdrop: 'static', scrollable: true, fullscreen: true }` |
| JsonSettingsDialog | `{ backdrop: 'static', scrollable: true, fullscreen: true }` |
| StorageSettingsDialog | `{ size: 'xl', backdrop: 'static', scrollable: true, windowClass: 'full-modal-dialog' }` |

### 4.6 index.html 基準

- `<html lang="zh-TW">`、title「ICRT For Kids 聽力練習」、`<base href="/">`（build 時以 `--base-href=/IcrtNewsLunchbox/` 覆蓋）。
- **Google Tag Manager**：`GTM-KMTSPF2X`（head script + body noscript iframe），升級後必須保留。
- **外部 CDN 資源**：Font Awesome 6.4.0（`cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`）——全站圖示皆依賴此 CDN；無其他外部字型。
- **Loading 畫面**（`#app-loading`）：紫色漸層背景 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`、耳機圖示 pulse 動畫、標題「ICRT For Kids / 聽力練習」、白色旋轉 spinner、「正在初始化應用程式...」文字；`.fade-out` 0.5s 淡出；768px 以下縮小字級。CSS 與 DOM 均內嵌於 index.html（不經 Angular 編譯）。

---

## 5. 建置基準（升級後比較基準）

`npm run build`（production，`--base-href=/IcrtNewsLunchbox/`）目前輸出：

| 輸出檔 | Raw size |
|---|---|
| main-*.js | 468.43 kB |
| styles-*.css | 240.88 kB |
| polyfills-*.js | 35.10 kB |
| **Initial total** | **744.40 kB** |

- 輸出目錄：`dist/browser`（gh-pages 部署來源）。
- 輸出雜湊：`outputHashing: all`。
- **目前唯一建置警告**：Bootstrap CSS「4 rules skipped due to selector errors」——來自 Bootstrap 5.3.3 min.css 中 `.form-floating>~label` 與 `.btn-group>.btn-group:not(.btn-check:first-child+.btn):not(...)>+.btn` 等選擇器無法被 CSS optimizer 解析。此警告為**已知且可接受**；升級後若警告消失或維持相同即符合預期，但不應出現新的警告或錯誤。
- budgets：initial 警告門檻 800kB（目前 744.40 kB 未觸發）、錯誤 1.2MB。升級後 Initial total 不應大幅超過 800kB 警告線。

---

## 6. 不可改變的行為（升級驗收條件）

1. **Hash 路由**：`provideRouter(routes, withHashLocation())`，網址必須維持 `/#/home` 形式（GitHub Pages 無伺服器端路由）。
2. **GitHub Pages base-href**：build 必須維持 `--base-href=/IcrtNewsLunchbox/`，部署 `dist/browser` 到 gh-pages。
3. **Loading 畫面**：index.html 內嵌 `#app-loading`，App 初始化完成（`SettingConfig.isInitialized`）後加 `.fade-out` 0.5 秒淡出並移除 DOM；初始化失敗也不得卡住（AppInitializer 失敗仍 resolve）。
4. **通知系統**：右上角固定通知（z-index 1070，壓在 modal 之上）、四種型別配色/圖示、自動消失時間 success 3s / error 5s / info 3s / warning 4s、可手動關閉、slideInRight 進場動畫。
5. **Android 實體返回鍵**：任何 dialog 開啟時按返回鍵只關閉 dialog、不離開頁面（TopicDetail/AddWord 經 AndroidBackButtonService；JsonSettings/StorageSettings 自行 popstate 實作）。
6. **學習狀態記憶**：主題詳情內變更學習狀態立即寫入 `icrt_learning_status`；主頁列表徽章與「學習狀態」篩選正確反映；篩選條件（含學習狀態）記憶於 `icrt_settings`。
7. **生字簿資料相容**：localStorage / IndexedDB 的 key、DB 名稱、資料結構（VocabularyWord、level 1/2/3）不得變動——既有使用者資料升級後必須可直接讀取；匯出/匯入 JSON 格式不變。
8. **選字加入生字簿**：雙擊/右鍵/長按（800ms、振動回饋）三種方式、選單 z-index 壓在 fullscreen modal 之上、10 秒自動隱藏、來源(title/topicId/section)自動帶入、同單字自動合併來源。
9. **音訊互動**：原生 audio 控制、逐段「跳到時間點」與暫停、關閉 dialog 停止播放。
10. **發音功能**：Web Speech API、en-US、rate 0.8、voices 延遲載入處理。
11. **測驗流程**：三階段狀態機、Fisher-Yates 隨機出題、不分大小寫判分、結果頁可逐題調整熟悉度並寫回生字簿、測驗設定記憶。
12. **防快取參數**：所有 assets/data JSON 請求附 `?v=<ts>&r=<rand>`。
13. **GTM 追蹤**：`GTM-KMTSPF2X` script/noscript 保留。
14. **RWD 行為**：576px / 768px / 400px 斷點下的既有版面（header 單行縮字、卡片間距、quiz 直排按鈕、modal 標題 ellipsis、topic-meta 不換行等）不得走樣。

---

## 7. 升級時需特別注意的程式碼現況（風險備忘）

以下為基準掃描時發現、升級到 Angular 22 時需逐一確認的點（詳細建議見升級計畫，不在本文件展開）：

- 全站模板使用**傳統 structural directives**（`*ngIf` / `*ngFor` / `ng-template` / `[ngClass]` / `[ngValue]`），未使用新 control flow（`@if` / `@for`）。
- 使用 decorator 式 `@Input()` / `@ViewChild()`（vocabulary-book `fileInput`、topic-detail-dialog `audioPlayer`），未使用 signal inputs/queries。
- 混用 constructor DI 與 `inject()`（add-word / json-settings / storage-settings 用 `inject(NgbActiveModal)`）。
- `provideAppInitializer` 已是新式 API（無 `APP_INITIALIZER` token 遺留）。
- 依賴 zone.js（`provideZoneChangeDetection`），大量邏輯依賴 zone 觸發變更偵測（document 層級 addEventListener、setTimeout 輪詢移除 loading、`speechSynthesis` callback），若未來改 zoneless 需全面重驗。
- `@angular/platform-browser-dynamic` 在 dependencies 中但程式未 import（main.ts 用 `bootstrapApplication`）。
- `@angular/localize` 僅作為 polyfill 掛載（`/// <reference types="@angular/localize">`），程式中未見 i18n 用法。
- `topic-detail-dialog.component.html` 有 `[@slideInOut]` 動畫綁定但元件未宣告 `animations`；Angular animations 套件也未安裝——升級後編譯器對缺失動畫的容忍度改變時可能報錯。
- `vocabulary-book.component.less` 使用 `::ng-deep`（棄用）；`app.component.less` 使用非標準 `:global {}` 區塊。
- `vocabulary-quiz.component.less` 使用 CSS `:has()`；variables.less 有變數後段覆蓋（@success-color 等）。
- ng-bootstrap 18 對應 Angular 19；升級 Angular 22 需同步升級 ng-bootstrap 主版本，NgbModal fullscreen/backdrop/windowClass 行為需回歸測試。
- Karma + Jasmine 測試 builder（`@angular-devkit/build-angular:karma`）在新版 Angular 已淡出，升級時 test target 可能需改（目前 repo 內無 *.spec.ts）。
- `document.caretRangeFromPoint` 為非標準/棄用 Web API（有 Firefox fallback），與 Angular 升級無關但為既知相依。
- `VocabularyQuizService.startQuiz` / `getAvailableWordsCount` 以 `new Promise(resolve => obs.subscribe(resolve))` 讀 BehaviorSubject（未 unsubscribe，因 BehaviorSubject 立即發值而可運作）；升級時 RxJS 行為不變即可，不需改。
- `WordSelectionService` 目前無人使用（遺留程式碼）；`models/topic.model.ts` 的 `VocabularyBookItem`、`StorageExportData` 亦未被引用。

# ICRT For Kids 聽力練習

本專案資料來源為 [ICRT News Lunchbox](https://www.icrt.com.tw/news_lunchbox.php?&mlevel1=7&mlevel2=96)，僅為教育目的將網站資料重新整理，讓預設不顯示中文翻譯，方便國中小學童進行英語聽力練習。

---

## 使用操作手冊

### 🏠 主頁功能
- **月份選擇**：下拉選單選擇要練習的月份
- **關鍵字搜尋**：在搜尋欄輸入關鍵字來篩選主題
- **類型篩選**：選擇特定的新聞類型（如 News、Story 等）
- **標籤篩選**：根據新聞標籤進行分類檢視
- **主題卡片**：點擊任一主題卡片開啟詳細內容

### 📖 主題詳情
- **音頻播放**：點擊播放按鈕收聽新聞內容
- **內容檢視**：預設顯示英文，點擊眼睛圖示顯示/隱藏中文翻譯
- **時間跳轉**：點擊時間標記快速跳到對應音頻位置
- **暫停播放**：點擊暫停按鈕控制音頻播放
- **測驗練習**：切換到測驗頁籤進行聽力測驗
- **生字管理**：選取文字右鍵添加到生字簿

### 📚 我的生字簿
- **查看生字**：檢視已儲存的單字及翻譯
- **難度分級**：
  - 🔴 不熟 (Unknown)
  - 🟡 尚可 (Fair) 
  - 🟢 記住了 (Known)
- **搜尋功能**：輸入關鍵字搜尋特定單字
- **發音功能**：點擊喇叭圖示收聽單字發音
- **編輯/刪除**：點擊編輯按鈕修改或刪除單字
- **匯出/匯入**：支援 JSON 格式的資料備份與還原

### 🛠️ 進階功能
- **儲存設定**：支援 LocalStorage 和 IndexedDB 兩種儲存方式
- **資料備份**：可匯出生字簿資料為 JSON 檔案
- **資料還原**：可匯入之前備份的 JSON 檔案
- **右鍵選單**：在內容中選取文字後右鍵可快速添加生字

### 💡 使用小技巧
1. **有效練習**：先純聽音頻，再對照文字內容
2. **生字學習**：將不熟悉的單字加入生字簿反覆練習
3. **測驗功能**：利用測驗頁籤檢驗聽力理解程度
4. **資料備份**：定期匯出生字簿資料以防遺失

---

## 技術規格

- **框架**：Angular 19
- **樣式**：Less + Bootstrap 5
- **儲存**：IndexedDB / LocalStorage
- **音頻**：HTML5 Audio API
- **響應式**：支援手機、平板、桌機

---

## 語音時間軸產生工具

使用 Node.js（18+）執行 `tools/update-audio-words.mjs`，會將月份 JSON 內
`content` 第一段 `time` 仍為 `null` 的主題，把 `audio` 網址丟給 Whisper 轉錄 API，
並將正規化後的逐段時間軸（`start_time`/`end_time` 為 `分:秒`，例 `1:02`）寫到
`public/assets/audio-words/<月份檔名>.json`，之後再交由 LLM 與來源 JSON 比對回寫。

API 網址不簽入版控：把 `.env.example` 複製為 `.env`（已在 `.gitignore`）填入
`TRANSCRIBE_API_URL`，或以 `--api-url` 參數覆寫：

```bash
# 排程用：不帶參數，處理最近兩個月（上個月與本月，避免跨月遺漏）
npm run audio-words

# 手動指定月份，可一次多個
npm run audio-words -- 202506 202507
```

輸出檔內已存在的 id 會自動略過（可用 `--force` 重新轉錄），每題成功後立即寫檔，
中斷後可直接續跑。執行 `node tools/update-audio-words.mjs --help` 查看所有參數；
單元測試以 `npm run test:tools` 執行。

### Gemini 時間戳合併

完成 Whisper 時間軸後，設定 `.env` 的 `GEMINI_API_KEY` 與 `GEMINI_MODEL`，再執行：

```bash
# 排程用：從 data 判斷並處理最近兩個月
npm run merge-audio-words

# 手動指定月份，可一次多個
npm run merge-audio-words -- 202506 202507
```

工具會從 `public/assets/data/<月份>.json` 開始掃描，只處理 `content` 第一段
`time` 仍為空的主題，依 `id` 取得 `public/assets/audio-words` 的 Whisper segments，
再由 Gemini 對齊並覆寫該題 `content`、`vocabulary.content` 與 `quiz` 的所有 `time`。
若 `content` 第一段已有 `time`，預設會整題略過，因此該題原本的時間戳不會被修改。
每題成功後會立即原子寫回 data，並緊接著同步 `months.json` 與 `tag.json`，因此中斷後可續跑，
也不必等整批完成才更新索引；使用 `--force` 可重做已有時間戳的主題。
Gemini 暫時性錯誤與短期分鐘額度會自動重試；若 API 要求等待超過 60 秒，該題會留待下次續跑，
避免單一長期 quota reset 卡住整批。提示詞放在 `tools/prompts/merge-audio-words.txt`，可直接修改；
請保留 `{{DATA_JSON}}` 與 `{{WHISPER_SUBTITLES}}` 兩個佔位符，也可用 `--prompt-file` 指定別的文字檔。
Gemini 會優先選擇 Whisper 已有的開始時間；若 Whisper 完全漏段，則依前後文與播放順序推估時間。
本機驗證會拒絕格式錯誤、超出音訊範圍、區段倒序，以及重複的 vocabulary／quiz 時間。
需要定向重做時可重複傳入 `--id <主題 id>`，並搭配 `--force`。
每題完成時會在終端顯示實際寫入三個區塊的時間戳。執行 `npm run merge-audio-words:help`
查看模型、提示詞、逾時、重試與資料夾等選項。

每題寫回 data 後，工具都會立即掃描 `data` 目錄的月份 JSON；整批結束時也會再校正一次。
只有該月份每一題的
`content`、`vocabulary.content`、`quiz` 全部已有 `time`，才會把缺少的月份及 tags 補進
`months.json` 與 `tag.json`；既有項目不會刪除。兩個索引都會去重排序，月份依年月升冪，
tags 依英文排序（其他文字排在英文之後），並以原子寫入更新。

---

## 版權聲明

- **資料來源**：本網站所有內容均來自 ICRT News Lunchbox 公開網站
- **版權歸屬**：所有音頻內容及文字版權歸 ICRT 所有
- **使用目的**：僅供教育用途，協助台灣學童英語學習
- **免責聲明**：本專案為非營利教育用途，如有版權疑慮請聯繫處理
- **資料處理**：僅對公開資料進行格式整理，未修改原始內容

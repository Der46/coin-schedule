# CLAUDE.md

Coin Master 每週活動時刻表：純靜態網站（無建置、無框架、無相依套件），部署在 GitHub Pages（https://der46.github.io/coin-999-schedule/），可安裝為 PWA。介面主要使用者是繁體中文玩家，回覆與文案預設用繁體中文。

## 本機執行

需要本機伺服器（`fetch` 載入 JSON、Service Worker 不能用 `file://`）：

```bash
python -m http.server 8000
```

打開 http://localhost:8000。改了 `app.js` / `style.css` 後若畫面沒變，是 Service Worker 快取（cache-first）造成的：在 DevTools 取消註冊 SW 並清除 Cache Storage 再重整。

沒有測試、lint 或建置流程；修改後用 `node --check app.js` 檢查語法，再實際開頁面確認（桌面與 375px 手機寬度、中文與至少一種其他語言）。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面骨架；`#nowCard`（現在進行中）、星期按鈕、`#scheduleView`（當日清單）都由 `app.js` 渲染 |
| `app.js` | 全部邏輯：載入 JSON、時區換算、解析活動、渲染、PWA 安裝提示 |
| `style.css` | 樣式；類別顏色 `.cat-*` / `.event-badge.*`（village、coin、hammer、card、mission、default） |
| `data.json` | 每週活動資料，`/1`~`/7` = 星期一~星期日 |
| `i18n.json` | 介面文字，9 種語言：zh-Hant、en、vi、ja、ko、th、id、es、pt-BR |
| `schedule-dictionaries.json` | 活動名稱的翻譯字典（中文 → 各語言，字串取代，長的 key 優先） |
| `service-worker.js` | 離線快取；`CACHE_NAME` 版本號 |
| `manifest.json`、`icons/` | PWA 設定與圖示 |

## data.json 格式

```json
{ "command": "/1", "title": "星期一活動", "description": "⏰星期一活動時間表⏰2026/8整合更新\n\n05:05 金槌🔨（1H）\n10:05 完村獎勵（登入後30Min）\n17:05 鬼牌競賽👻" }
```

- `description` 每行 `HH:MM 活動名稱（持續時間）（備註）`；不是 `HH:MM` 開頭的行視為標題，其中的 `YYYY/M` 會顯示為更新日期。
- 時間一律是 **UTC+8** 原始時間，`app.js` 會依語言換算時區（`LANGUAGE_TIMEZONE_OFFSET_MINUTES`），可能跨到前/後一天。
- 持續時間：括號內「數字 + 單位」（`H`、`Min`，也接受 `小時`、`分`），前面可帶文字如 `登入後`（會變成備註）。**沒有可靠來源就不要寫時長**，畫面會顯示「未標時長」。
- 其他括號內容都當成備註標籤；`———文字———` 這種行會顯示成分隔線。
- 類別由 `getEventCategory()` 依關鍵字判斷（建村/完村→村落、金槌/🔨→金槌、卡牌/完冊→卡牌、金幣→金幣、其他活動關鍵字→活動）。

## 修改時注意

- **新增介面文字**：在 `i18n.json` 的 **9 種語言都要加同一個 key**；樣板用 `{n}`、`{t}`、`{time}` 佔位，透過 `tf(key, vars)` 取代。
- **新增活動名稱**：若需翻譯，加進 `schedule-dictionaries.json` 各語言。持續時間單位（`H`/`Min`）不要放進字典，否則解析會失效。
- **改了 `app.js`、`style.css`、`index.html` 或圖示**：把 `service-worker.js` 的 `CACHE_NAME` 版本號 +1，已安裝的使用者才會更新。JSON 檔是 network-first，不需要改版號。
- 插入 HTML 的所有資料都要經過 `escapeHtml()`。
- `localStorage` 讀寫要包 try/catch（用 `readPref` / `writePref`）。
- 不要用 `transition: all`；數字/時間用 `font-variant-numeric: tabular-nums`；手機版（≤520px）不可出現水平捲動。
- 檔案使用 **CRLF** 換行；用腳本做多行比對/取代前先把 `\r\n` 正規化。
- 不需要時不要加入建置工具、框架或外部 CDN 相依。

## 渲染流程（app.js）

`loadSettings()`（i18n + 字典）→ `loadData()` → `selectTodayForCurrentLanguageTimezone()` → `selectItem()` → `renderScheduleView()`（同時呼叫 `renderNowCard()`）。
活動解析在 `parseScheduleDescriptionForSourceItem()` / `parseEventText()`；以「一週分鐘數」（`weekStart`、`WEEK_MINUTES`）判斷進行中、已結束、即將開始，跨午夜的活動會出現在隔天的「延續自前一天」。`refreshLiveViews()` 每 30 秒更新一次。

## 頁尾署名

資料提供：CM大佬群；網頁製作：Coin999-長長久久隊伍。不要更動這些署名。

<p align="center">
  <img src="icons/icon.svg" width="128" height="128" alt="活動時刻表 icon" />
</p>

<h1 align="center">活動時刻表</h1>

<p align="center">
  Coin Master 每週活動時間表 · 多語系 · 自動時區換算 · 可安裝為 PWA
</p>

<p align="center">
  <a href="https://der46.github.io/coin-999-schedule/">🔗 線上使用</a>
</p>

---

## 功能

- **每週活動時間表**：依星期一到星期日分頁，預設顯示今天的活動。
- **自動時區換算**：活動時間會換算成使用者所在地區的時間。
- **多語系介面**：中文、English、Tiếng Việt、日本語、한국어、ไทย、Bahasa Indonesia、Español、Português。
- **安裝成 APP（PWA）**：支援「加入主畫面」，離線時也能查看已快取的時間表。
- **工具連結**：耕種計算機、活動道具換算、每日獎勵連結、建村金額等常用小工具。

## 專案結構

```
.
├── index.html                  # 頁面
├── style.css                   # 樣式
├── app.js                      # 主程式：載入資料、時區換算、渲染時間表、安裝提示
├── data.json                   # 每週活動資料（/1 ~ /7 對應星期一 ~ 星期日）
├── i18n.json                   # 介面文字翻譯
├── schedule-dictionaries.json  # 活動名稱翻譯字典
├── manifest.json               # PWA 設定
├── service-worker.js           # 離線快取
└── icons/
    ├── icon.svg                # APP 圖示（原始 SVG）
    ├── icon-192.png
    └── icon-512.png
```

## 更新活動時間

活動內容都在 [`data.json`](data.json)，每一天一筆：

```json
{
    "command": "/1",
    "title": "星期一活動",
    "description": "⏰星期一活動時間表⏰2026/8整合更新\n\n05:05 金槌🔨\n09:05 建村20%🏘️"
}
```

- `description` 每行一個活動，格式為 `HH:MM 活動名稱（持續時間）（備註）`，例如 `05:05 金槌🔨（1H）`、`10:05 完村獎勵（登入後30Min）`。
- 持續時間寫在括號內，單位可用 `H` / `Min`（也接受 `小時` / `分`）；沒有已知時長就不要寫，畫面會顯示「未標時長」。
- 有標時長的活動會自動算出結束時間、顯示「進行中／剩餘時間／已結束」，跨午夜的活動也會出現在隔天的「延續自前一天」。
- 新增的活動名稱若需要翻譯，請加到 [`schedule-dictionaries.json`](schedule-dictionaries.json)。
- 資料檔採「網路優先」快取策略，推上 GitHub 後使用者重新整理即可取得最新內容。

## 本機執行

純靜態網站，不需要建置。因為使用 `fetch` 載入 JSON 與 Service Worker，請用本機伺服器開啟：

```bash
python -m http.server 8000
```

然後打開 <http://localhost:8000>。

## APP 圖示

圖示原稿為 [`icons/icon.svg`](icons/icon.svg)（行事曆 + 金幣時鐘），背景滿版，可作為 maskable icon 使用。修改 SVG 後請一併重新輸出 `icon-192.png` 與 `icon-512.png`，並調整 `service-worker.js` 中的 `CACHE_NAME` 版本號，讓已安裝的使用者更新快取。

## 致謝

- 資料提供：CM大佬群
- 網頁製作：Coin999-長長久久隊伍

> 活動時間僅供參考，實際內容請以遊戲內顯示為準。

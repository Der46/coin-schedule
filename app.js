"use strict";

let DATA = [];
let currentSelected = null;
let dataLoaded = false;
let selectedCommand = "";
let currentLang = localStorage.getItem("coin999_lang") || "zh-Hant";
let I18N = {};
let SCHEDULE_DICTIONARIES = {};

const t = key => I18N[currentLang]?.[key] || I18N["zh-Hant"]?.[key] || key;

const $ = id => document.getElementById(id);

const detailSection = $("dailyScheduleSection");
const detailEmpty = $("detailEmpty");
const detailBox = $("detailBox");
const detailCommand = $("detailCommand");
const todayBadge = $("todayBadge");
const detailTitle = $("detailTitle");
const scheduleView = $("scheduleView");
const detailDescription = $("detailDescription");
const rawToggleBtn = $("rawToggleBtn");
const toast = $("toast");
const copyrightYear = $("copyrightYear");
const languageSelect = $("languageSelect");

const weekdayButtons = $("weekdayButtons");
const weekdaySubtitle = $("weekdaySubtitle");

const mobileMenuBtn = $("mobileMenuBtn");
const desktopToolBtn = $("desktopToolBtn");
const mobileSidebar = $("mobileSidebar");
const mobileSidebarClose = $("mobileSidebarClose");
const sidebarOverlay = $("sidebarOverlay");

const pad2 = number => String(number).padStart(2, "0");

const SOURCE_TIMEZONE_OFFSET_MINUTES = 8 * 60;

const WEEKDAY_COMMANDS = ["/1", "/2", "/3", "/4", "/5", "/6", "/7"];
const WEEKDAY_I18N_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const JS_WEEKDAY_I18N_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const LANGUAGE_TIMEZONE_OFFSET_MINUTES = {
    "zh-Hant": 8 * 60,
    en: 0,
    vi: 7 * 60,
    ja: 9 * 60,
    ko: 9 * 60,
    th: 7 * 60,
    id: 7 * 60,
    es: -5 * 60,
    "pt-BR": -3 * 60
};

function getBrowserTimezoneOffsetMinutes() {
    return -new Date().getTimezoneOffset();
}

function getCurrentTimezoneOffsetMinutes() {
    return LANGUAGE_TIMEZONE_OFFSET_MINUTES[currentLang] ?? getBrowserTimezoneOffsetMinutes();
}

function isUsingBrowserTimezone() {
    return !(currentLang in LANGUAGE_TIMEZONE_OFFSET_MINUTES);
}

function getTimezoneLabel() {
    const offset = getCurrentTimezoneOffsetMinutes();
    const sign = offset >= 0 ? "+" : "-";
    const abs = Math.abs(offset);
    const hour = Math.floor(abs / 60);
    const minute = abs % 60;
    const utcLabel = `UTC${sign}${pad2(hour)}:${pad2(minute)}`;

    return isUsingBrowserTimezone() ? `${utcLabel} Local` : utcLabel;
}

function commandToIndex(command) {
    const index = WEEKDAY_COMMANDS.indexOf(command);
    return index >= 0 ? index : 0;
}

function indexToCommand(index) {
    const normalized = ((index % WEEKDAY_COMMANDS.length) + WEEKDAY_COMMANDS.length) % WEEKDAY_COMMANDS.length;
    return WEEKDAY_COMMANDS[normalized];
}

function convertSourceTimeToCurrentTimezone(time, sourceCommand) {
    const [hour, minute] = String(time).split(":").map(Number);

    const sourceTotalMinutes = hour * 60 + minute;
    const diff = getCurrentTimezoneOffsetMinutes() - SOURCE_TIMEZONE_OFFSET_MINUTES;

    let convertedTotalMinutes = sourceTotalMinutes + diff;
    let dayShift = 0;

    while (convertedTotalMinutes < 0) {
        convertedTotalMinutes += 1440;
        dayShift -= 1;
    }

    while (convertedTotalMinutes >= 1440) {
        convertedTotalMinutes -= 1440;
        dayShift += 1;
    }

    const convertedHour = Math.floor(convertedTotalMinutes / 60);
    const convertedMinute = convertedTotalMinutes % 60;

    const sourceIndex = commandToIndex(sourceCommand);
    const targetCommand = indexToCommand(sourceIndex + dayShift);

    return {
        time: `${pad2(convertedHour)}:${pad2(convertedMinute)}`,
        hour: convertedHour,
        minute: convertedMinute,
        dayShift,
        targetCommand
    };
}

function getNowInCurrentTimezone() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;

    return new Date(utc + getCurrentTimezoneOffsetMinutes() * 60000);
}

function getDisplayDateInCurrentTimezone() {
    return getNowInCurrentTimezone();
}

function getWeekdayCommandInCurrentTimezone() {
    const date = getNowInCurrentTimezone();
    const day = date.getDay();

    return day === 0 ? "/7" : `/${day}`;
}

const escapeHtml = text => String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getDisplayDate = date => `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

const getWeekdayCommandByDate = () => getWeekdayCommandInCurrentTimezone();

const getWeekdayNameByDate = () => {
    const date = getNowInCurrentTimezone();
    return t(JS_WEEKDAY_I18N_KEYS[date.getDay()]);
};

const getCommandLabel = command => {
    const index = commandToIndex(command);
    return t(WEEKDAY_I18N_KEYS[index]) || "";
};

const normalizeText = text => String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/^\/+/, "")
    .replace(/週/g, "周")
    .replace(/禮拜/g, "星期")
    .replace(/星期天/g, "星期日")
    .replace(/周天/g, "周日")
    .replace(/金鎚/g, "金槌")
    .replace(/金錘/g, "金槌")
    .replace(/攀爬/g, "攀登")
    .replace(/\/+/g, "");

const findItemByCommand = command => {
    return DATA.find(item => normalizeText(item.command) === normalizeText(command));
};

const normalizeTime = time => {
    const [hour, minute] = String(time).split(":");
    return `${pad2(Number(hour))}:${pad2(Number(minute))}`;
};

const getUpdateText = text => {
    const match = String(text || "").match(/(\d{4}\/\d{1,2})/);

    if (!match) return "";

    return `${match[1]} ${t("updateLabel")}`;
};

const linkifyText = text => escapeHtml(text || "").replace(
    /(https?:\/\/[^\s<]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
);

function cleanupTranslatedScheduleText(text) {
    let result = String(text || "");

    if (currentLang === "zh-Hant") {
        return result;
    }

    result = result
        .replace(/，/g, ", ")
        .replace(/、/g, ", ")
        .replace(/（/g, " (")
        .replace(/）/g, ") ")
        .replace(/[ ]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/ ?\n ?/g, "\n")
        .replace(/(\d{1,2}:\d{2})\s+/g, "$1 ")

        .replace(/([A-Za-zÀ-ỹ])(\d+%)/g, "$1 $2")
        .replace(/(\d+%)([A-Za-zÀ-ỹ])/g, "$1 $2")

        .replace(/([A-Za-zÀ-ỹ])or([A-Za-zÀ-ỹ])/g, "$1 or $2")
        .replace(/([A-Za-zÀ-ỹ])Or([A-Za-zÀ-ỹ])/g, "$1 or $2")
        .replace(/([A-Za-zÀ-ỹ])và([A-Za-zÀ-ỹ])/g, "$1 và $2")
        .replace(/([A-Za-zÀ-ỹ])hoặc([A-Za-zÀ-ỹ])/g, "$1 hoặc $2")

        .replace(/Team\s*Hammer/g, "Team Hammer")
        .replace(/Đội\s*Búa/g, "Đội Búa")

        .replace(/Coin Craze\s*150%/g, "Coin Craze 150%")
        .replace(/Card Boost\s*50%/g, "Card Boost 50%")
        .replace(/Set Blast\s*30%/g, "Set Blast 30%")

        .replace(/Sự kiện xu\s*150%/g, "Sự kiện xu 150%")
        .replace(/Tăng thẻ\s*50%/g, "Tăng thẻ 50%")
        .replace(/Sao băng hoàn bộ\s*30%/g, "Sao băng hoàn bộ 30%")

        .replace(/Energy\s*or\s*Right-side Event\s*Reward/g, "Energy or Right-side Event Reward")
        .replace(/Energy\s*or\s*Right-side Event/g, "Energy or Right-side Event")
        .replace(/Năng lượng\s*or\s*Sự kiện bên phải\s*Phần thưởng/g, "Năng lượng hoặc phần thưởng sự kiện bên phải")
        .replace(/Năng lượng\s*or\s*Sự kiện bên phải/g, "Năng lượng hoặc sự kiện bên phải")

        .replace(/Paid\s+Rare/g, "Paid Rare")
        .replace(/Trả phí\s+Ít xuất hiện/g, "Trả phí Ít xuất hiện")

        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .replace(/[ ]{2,}/g, " ")
        .trim();

    return result;
}

function translateScheduleText(text) {
    if (currentLang === "zh-Hant") return String(text || "");

    const dictionary = SCHEDULE_DICTIONARIES[currentLang];

    if (!dictionary || typeof dictionary !== "object") {
        return String(text || "");
    }

    let result = String(text || "");

    Object.entries(dictionary)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([from, to]) => {
            result = result.split(from).join(to);
        });

    return cleanupTranslatedScheduleText(result);
}

function getLocalizedValue(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const direct = value[currentLang];

        if (direct) {
            return currentLang === "zh-Hant"
                ? String(direct || "")
                : cleanupTranslatedScheduleText(direct);
        }

        const fallback = value["zh-Hant"] || value.en || value.vi || "";

        return currentLang === "zh-Hant"
            ? String(fallback || "")
            : translateScheduleText(fallback || "");
    }

    return translateScheduleText(value || "");
}

function getItemTitle(item) {
    return getLocalizedValue(item.title);
}

function getItemDescription(item) {
    return getLocalizedValue(item.description);
}

function applyI18n() {
    document.documentElement.lang = currentLang;
    document.title = t("pageTitle");

    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.dataset.i18n;
        element.textContent = t(key);
    });

    if (languageSelect) {
        languageSelect.value = currentLang;
    }

    if (rawToggleBtn && !detailDescription.classList.contains("show")) {
        rawToggleBtn.textContent = t("showRaw");
    }

    updateWeekdayButtons(selectedCommand || getWeekdayCommandByDate());

    if (currentSelected) {
        selectItem(currentSelected, false);
    }
}

async function loadJsonFile(url, fallbackValue) {
    try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`${url} HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[JSON Load Failed] ${url}`, error);
        return fallbackValue;
    }
}

async function loadSettings() {
    const [i18nData, dictionaryData] = await Promise.all([
        loadJsonFile("i18n.json", {}),
        loadJsonFile("schedule-dictionaries.json", {})
    ]);

    I18N = i18nData && typeof i18nData === "object" ? i18nData : {};
    SCHEDULE_DICTIONARIES = dictionaryData && typeof dictionaryData === "object" ? dictionaryData : {};

    if (!I18N[currentLang]) {
        currentLang = "zh-Hant";
        localStorage.setItem("coin999_lang", currentLang);
    }
}

async function loadData() {
    try {
        detailEmpty.innerHTML = `
                <div class="loading-box">
                    ${escapeHtml(t("loadingData"))}<br />
                    ${escapeHtml(t("readingData"))} <strong>data.json</strong>
                </div>
            `;

        const jsonData = await loadJsonFile("data.json", null);

        if (!jsonData) {
            throw new Error("data.json load failed");
        }

        if (!Array.isArray(jsonData)) {
            throw new Error(t("jsonFormatError"));
        }

        DATA = jsonData.map(item => ({
            command: item.command || "",
            title: item.title || "",
            type: item.type || "schedule",
            description: item.description || ""
        }));

        dataLoaded = true;

        const todayCommand = getWeekdayCommandByDate();

        selectWeekdayCommand(todayCommand, {
            scrollToDetail: false,
            toastMessage: ""
        });

    } catch (error) {
        dataLoaded = false;
        DATA = [];

        detailEmpty.style.display = "block";
        detailBox.classList.remove("show");

        detailEmpty.innerHTML = `
                <div class="error-box">
                    <strong>${escapeHtml(t("dataLoadFailed"))}</strong><br />
                    ${escapeHtml(t("dataLoadHint"))}<br />
                    <span>${escapeHtml(error.message)}</span>
                </div>
            `;
    }
}

function updateWeekdayButtons(command) {
    selectedCommand = command;

    const todayCommand = getWeekdayCommandByDate();

    document.querySelectorAll(".weekday-btn").forEach(button => {
        const isActive = button.dataset.command === command;
        const isToday = button.dataset.command === todayCommand;

        button.classList.toggle("active", isActive);
        button.classList.toggle("today", isToday);
    });

    if (weekdaySubtitle && command) {
        const label = getCommandLabel(command);
        const todayLabel = getCommandLabel(todayCommand);
        const timezoneLabel = getTimezoneLabel();

        weekdaySubtitle.textContent = label === todayLabel
            ? `${t("currentlyShowing")}：${label}${t("activity")}（${t("today")}｜${timezoneLabel}）`
            : `${t("currentlyShowing")}：${label}${t("activity")}｜${t("todayIs")}${todayLabel}｜${timezoneLabel}`;
    }
}

function selectWeekdayCommand(command, options = {}) {
    if (!dataLoaded) {
        showToast(t("dataNotLoaded"));
        return;
    }

    const item = findItemByCommand(command);

    if (!item) {
        showToast(`${t("notFound")} ${command}`);
        return;
    }

    updateWeekdayButtons(command);
    selectItem(item, options.scrollToDetail ?? false);

    if (options.toastMessage) {
        showToast(options.toastMessage);
    }
}

const parseDuration = text => {
    const matches = [...String(text).matchAll(/[（(]([^）)]+)[）)]/g)];

    for (const match of matches) {
        const inside = match[1].trim();

        const isDuration =
            /^\d+\s*(?:Min|mins|min|分鐘|分|H|Hr|hrs|小時)$/i.test(inside) ||
            /^登入後?\s*\d+\s*(?:Min|mins|min|分鐘|分|H|Hr|hrs|小時)$/i.test(inside) ||
            /^(After Login|Sau khi đăng nhập|ログイン後|로그인 후|หลังเข้าสู่ระบบ|Setelah login|Después de iniciar sesión|Após login)\s*\d+\s*(?:Min|mins|min|H|Hr|hrs|分鐘|分|小時)$/i.test(inside);

        if (isDuration) {
            return {
                label: inside,
                raw: match[0]
            };
        }
    }

    return {
        label: "",
        raw: ""
    };
};

function splitEventText(text, durationRaw) {
    let name = String(text || "").trim();
    let note = "";

    if (durationRaw) {
        const index = name.indexOf(durationRaw);

        if (index >= 0) {
            const before = name.slice(0, index).trim();
            const after = name.slice(index + durationRaw.length).trim();

            name = before || name;
            note = after;
        }
    }

    const noteMatch = name.match(/[（(]([^）)]+)[）)]/);

    if (noteMatch) {
        const before = name.slice(0, noteMatch.index).trim();
        const inside = noteMatch[1].trim();
        const after = name.slice(noteMatch.index + noteMatch[0].length).trim();

        if (before) {
            name = before;
            note = [inside, after].filter(Boolean).join(" ");
        }
    }

    name = name
        .replace(/（\s*）/g, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();

    note = note
        .replace(/\s+/g, " ")
        .trim();

    return {
        name,
        note
    };
}

const getEventCategory = text => {
    const value = String(text || "");

    if (
        /建村|完村|村落爆增|村落|Village Build|Village Completion|Village Boom|Xây làng|hoàn thành làng|Bùng nổ làng|Làng/i.test(value) ||
        /村建設|村完成報酬|村ブーム|村/i.test(value) ||
        /마을 건설|마을 완료 보상|마을 붐|마을/i.test(value) ||
        /สร้างหมู่บ้าน|รางวัลสร้างหมู่บ้าน|Village Boom|หมู่บ้าน/i.test(value) ||
        /Bangun Desa|Hadiah Selesai Desa|Desa/i.test(value) ||
        /Construcción de aldea|Recompensa por completar aldea|Auge de aldea|Aldea/i.test(value) ||
        /Construção da vila|Recompensa por concluir a vila|Boom da vila|Vila/i.test(value)
    ) {
        return "village";
    }

    if (
        /金槌|金鎚|金錘|團隊金|槌|鎚|錘|🔨|Hammer|Team Hammer|Búa|Đội Búa/i.test(value) ||
        /ハンマー|ゴールデンハンマー/i.test(value) ||
        /해머|골든 해머/i.test(value) ||
        /ค้อน|ค้อนทอง/i.test(value) ||
        /Palu|Palu Emas/i.test(value) ||
        /Martillo|Martillo dorado/i.test(value) ||
        /Martelo|Martelo dourado/i.test(value)
    ) {
        return "hammer";
    }

    if (
        /卡牌|金卡|藍卡|完冊|流星|Card Boost|Gold Card|Blue Card|Set Blast|Cards|Thẻ|Tăng thẻ|Sao băng|thẻ vàng|thẻ xanh/i.test(value) ||
        /カード|ゴールドカード|ブルーカード|セットブラスト|カードブースト/i.test(value) ||
        /카드|골드 카드|블루 카드|세트 블라스트|카드 부스트/i.test(value) ||
        /การ์ด|การ์ดทอง|การ์ดฟ้า|Set Blast|Card Boost/i.test(value) ||
        /Kartu|Kartu Emas|Kartu Biru|Set Blast|Card Boost/i.test(value) ||
        /Cartas|Carta dorada|Carta azul|Aumento de cartas|Set Blast/i.test(value) ||
        /Carta dourada|Carta azul|Aumento de cartas|Set Blast/i.test(value)
    ) {
        return "card";
    }

    if (
        /金幣狂歡|金幣|Coin Craze|Coins|Sự kiện xu|Xu|150%/i.test(value) ||
        /コインクレイズ|コイン/i.test(value) ||
        /코인 크레이즈|코인/i.test(value) ||
        /เหรียญ|Coin Craze/i.test(value) ||
        /Koin|Coin Craze/i.test(value) ||
        /Fiebre de monedas|Monedas/i.test(value) ||
        /Festa de moedas|Moedas/i.test(value)
    ) {
        return "coin";
    }

    if (
        /鬼牌|競賽|競技|任務|維京|攀登|攀爬|保險箱|雷幣|財寶|寶藏|荒野|銀河|三霸|小徑|代幣|衝刺|首領|寵物|賽季|通行證|獎賞|探索|活動|更新/i.test(value) ||
        /Event|Mission|Competition|Joker|Viking|Galaxy|Treasure|Reward Road|Build Rush|Rush|Token|Pass|Arena|Adventure|Bonus/i.test(value) ||
        /Sự kiện|Nhiệm vụ|Bộ ba|Kho báu|Con đường|Cơn sốt|Viking|Joker/i.test(value) ||
        /イベント|ジョーカー|競争|トーナメント|ミッション|バイキング|宝|荒野|ギャラクシー|トリオ|パス|報酬|ラッシュ|アリーナ|ボーナス/i.test(value) ||
        /이벤트|조커|경쟁|토너먼트|미션|바이킹|보물|황야|갤럭시|트리오|패스|보상|러시|아레나|보너스/i.test(value) ||
        /กิจกรรม|การแข่งขัน|ทัวร์นาเมนต์|ภารกิจ|สมบัติ|ป่า|เส้นทาง|รางวัล|โบนัส|Viking|Joker|Galaxy|Token|Pass/i.test(value) ||
        /Event|Kompetisi|Turnamen|Misi|Harta|Liar|Jalur|Hadiah|Bonus|Viking|Joker|Galaxy|Token|Pass/i.test(value) ||
        /Evento|Competencia|Torneo|Misión|Tesoro|Salvaje|Camino|Recompensa|Bono|Vikingo|Joker|Token|Pase/i.test(value) ||
        /Competição|Torneio|Missão|Tesouro|Selvagem|Caminho|Recompensa|Bônus|Viking|Joker|Token|Passe/i.test(value)
    ) {
        return "mission";
    }

    return "default";
};

const getCategoryLabel = category => ({
    village: t("categoryVillage"),
    coin: t("categoryCoin"),
    hammer: t("categoryHammer"),
    card: t("categoryCard"),
    mission: t("categoryMission"),
    default: t("categoryDefault")
}[category] || t("categoryDefault"));

function parseScheduleDescriptionForSourceItem(item) {
    const description = getItemDescription(item);

    const lines = String(description || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const headerLines = [];
    const events = [];

    lines.forEach((line, index) => {
        const match = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);

        if (!match) {
            headerLines.push(line);
            return;
        }

        const sourceTime = normalizeTime(match[1]);
        const text = match[2].trim();
        const durationInfo = parseDuration(text);
        const cleanInfo = splitEventText(text, durationInfo.raw);
        const converted = convertSourceTimeToCurrentTimezone(sourceTime, item.command);

        events.push({
            id: `${item.command}-${index}`,
            sourceCommand: item.command,
            sourceTime,
            time: converted.time,
            hour: converted.hour,
            minute: converted.minute,
            targetCommand: converted.targetCommand,
            dayShift: converted.dayShift,
            name: cleanInfo.name,
            note: cleanInfo.note,
            durationText: durationInfo.label,
            original: text,
            category: getEventCategory(text)
        });
    });

    return {
        header: headerLines.join(" "),
        events
    };
}

function getEventsForDisplayCommand(displayCommand) {
    const allEvents = [];

    DATA.forEach(item => {
        const parsed = parseScheduleDescriptionForSourceItem(item);

        parsed.events.forEach(event => {
            if (event.targetCommand === displayCommand) {
                allEvents.push(event);
            }
        });
    });

    allEvents.sort((a, b) => {
        const aMinutes = a.hour * 60 + a.minute;
        const bMinutes = b.hour * 60 + b.minute;

        if (aMinutes !== bMinutes) return aMinutes - bMinutes;

        return String(a.name).localeCompare(String(b.name));
    });

    return allEvents;
}

function renderScheduleView(item) {
    const displayCommand = selectedCommand || item.command;
    const eventsForDisplay = getEventsForDisplayCommand(displayCommand);

    if (!eventsForDisplay.length) {
        scheduleView.innerHTML = `
                <div class="no-result">
                    ${escapeHtml(t("noSchedule"))}
                </div>
            `;
        return;
    }

    const grouped = new Map(Array.from({ length: 24 }, (_, hour) => [hour, []]));

    eventsForDisplay.forEach(event => {
        grouped.get(event.hour).push(event);
    });

    const firstEvent = eventsForDisplay[0];
    const lastEvent = eventsForDisplay[eventsForDisplay.length - 1];

    const todayCommand = getWeekdayCommandByDate();
    const isSelectedToday = selectedCommand === todayCommand;
    const currentHour = getNowInCurrentTimezone().getHours();

    const headerTitle = `${getCommandLabel(displayCommand)} ${t("dailySchedule")}｜${getTimezoneLabel()}`;
    const updateText = getUpdateText(getItemDescription(item));

    const rows = Array.from({ length: 24 }, (_, hour) => {
        const events = grouped.get(hour) || [];
        const isCurrent = isSelectedToday && hour === currentHour;

        const eventRows = events.length ? events.map(event => {
            const sourceHint = event.dayShift !== 0
                ? `<div class="event-note">${escapeHtml(`${t("sourceTime")}：${getCommandLabel(event.sourceCommand)} ${event.sourceTime} UTC+08:00`)}</div>`
                : "";

            return `
                    <div class="event-cell-row">
                        <span class="event-start">${escapeHtml(event.time)}~</span>
                        <span class="event-badge ${escapeHtml(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
                        <div class="event-title-wrap">
                            <div class="event-name">${escapeHtml(event.name)}</div>
                            ${event.note ? `<div class="event-note">${escapeHtml(event.note)}</div>` : ""}
                            ${sourceHint}
                        </div>
                    </div>
                `;
        }).join("") : `<div class="empty-event-row"></div>`;

        const durationRows = events.length ? events.map(event => `
                <div class="duration-cell-row">${event.durationText ? escapeHtml(event.durationText) : ""}</div>
            `).join("") : `<div class="empty-duration-row"></div>`;

        return `
                <div class="schedule-hour-row ${isCurrent ? "current-hour" : ""}">
                    <div class="hour-time-cell">${hour}:00~</div>
                    <div class="hour-events-cell">${eventRows}</div>
                    <div class="hour-duration-cell">${durationRows}</div>
                </div>
            `;
    }).join("");

    scheduleView.innerHTML = `
            <div class="schedule-summary">
                <div class="summary-card">
                    <div class="summary-label">${escapeHtml(t("eventCount"))}</div>
                    <div class="summary-value">${eventsForDisplay.length}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${escapeHtml(t("firstEvent"))}</div>
                    <div class="summary-value">${escapeHtml(firstEvent.time)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${escapeHtml(t("lastEvent"))}</div>
                    <div class="summary-value">${escapeHtml(lastEvent.time)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${escapeHtml(t("currentPeriod"))}</div>
                    <div class="summary-value">${isSelectedToday ? `${currentHour}:00` : "-"}</div>
                </div>
            </div>

            <div class="schedule-shell" id="scheduleShell">
                <div class="schedule-fit" id="scheduleFit">
                    <div class="schedule-board" id="scheduleBoard">
                        <div class="schedule-board-head">
                            <div class="schedule-head-cell">${escapeHtml(t("time"))}</div>
                            <div class="schedule-head-cell">
                                <div>
                                    <div>${escapeHtml(headerTitle)}</div>
                                    ${updateText ? `<div class="schedule-update">${escapeHtml(updateText)}</div>` : ""}
                                </div>
                            </div>
                            <div class="schedule-head-cell">${escapeHtml(t("duration"))}</div>
                        </div>

                        ${rows}
                    </div>
                </div>
            </div>
        `;

    requestAnimationFrame(() => {
        fitScheduleBoard();

        const currentRow = scheduleView.querySelector(".schedule-hour-row.current-hour");

        if (currentRow && window.innerWidth > 820) {
            currentRow.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    });
}

function fitScheduleBoard() {
    const fit = $("scheduleFit");
    const board = $("scheduleBoard");

    if (!fit || !board) return;

    board.style.transform = "";
    fit.style.height = "";

    if (window.innerWidth > 820) return;

    const availableWidth = fit.clientWidth;
    const boardWidth = board.offsetWidth;

    if (!availableWidth || !boardWidth) return;

    const scale = Math.min(availableWidth / boardWidth, 1);

    board.style.transform = `scale(${scale})`;
    fit.style.height = `${board.offsetHeight * scale}px`;
}

function renderVisibleDescription(item) {
    const description = String(getItemDescription(item) || "").trim();

    if (!description) {
        hideRawDescription();
        return;
    }

    detailDescription.innerHTML = linkifyText(description).replace(/\n/g, "<br>");
    detailDescription.classList.add("show");
}

function hideRawDescription() {
    detailDescription.innerHTML = "";
    detailDescription.classList.remove("show");

    if (rawToggleBtn) {
        rawToggleBtn.textContent = t("showRaw");
    }
}

function selectItem(item, scrollToDetail = false) {
    currentSelected = item;

    detailEmpty.style.display = "none";
    detailBox.classList.add("show");

    detailCommand.textContent = item.command || "";
    detailTitle.textContent = getItemTitle(item) || t("dailySchedule");

    const todayCommand = getWeekdayCommandByDate();
    const selectedLabel = getCommandLabel(selectedCommand);
    const todayLabel = getCommandLabel(todayCommand);
    const timezoneNow = getDisplayDateInCurrentTimezone();

    todayBadge.textContent = selectedCommand === todayCommand
        ? `${t("today")}｜${getDisplayDate(timezoneNow)} ${getWeekdayNameByDate()}｜${getTimezoneLabel()}`
        : `${t("currentSelection")}：${selectedLabel}｜${t("todayIs")}${todayLabel}｜${getTimezoneLabel()}`;

    hideRawDescription();
    renderScheduleView(item);

    if (scrollToDetail && detailSection) {
        detailSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function showToast(message) {
    if (!toast || !message) return;

    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 1800);
}

function openSidebar() {
    mobileSidebar.classList.add("show");
    sidebarOverlay.classList.add("show");
    document.body.classList.add("sidebar-open");
}

function closeSidebar() {
    mobileSidebar.classList.remove("show");
    sidebarOverlay.classList.remove("show");
    document.body.classList.remove("sidebar-open");
}

function bindEvents() {
    if (languageSelect) {
        languageSelect.addEventListener("change", () => {
            currentLang = languageSelect.value;
            localStorage.setItem("coin999_lang", currentLang);
            applyI18n();
        });
    }

    if (weekdayButtons) {
        weekdayButtons.querySelectorAll(".weekday-btn").forEach(button => {
            button.addEventListener("click", () => {
                const command = button.dataset.command;

                selectWeekdayCommand(command, {
                    scrollToDetail: false,
                    toastMessage: `${t("switchedTo")}：${getCommandLabel(command)}${t("activity")}`
                });
            });
        });
    }

    if (rawToggleBtn) {
        rawToggleBtn.addEventListener("click", () => {
            if (!currentSelected) return;

            const isVisible = detailDescription.classList.contains("show");

            if (isVisible) {
                hideRawDescription();
            } else {
                renderVisibleDescription(currentSelected);
                rawToggleBtn.textContent = t("hideRaw");
            }
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", openSidebar);
    }

    if (desktopToolBtn) {
        desktopToolBtn.addEventListener("click", openSidebar);
    }

    if (mobileSidebarClose) {
        mobileSidebarClose.addEventListener("click", closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeSidebar);
    }

    document.querySelectorAll(".mobile-tool-nav a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", fitScheduleBoard);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    await loadSettings();

    if (languageSelect) {
        languageSelect.value = currentLang;
    }

    applyI18n();
    bindEvents();
    loadData();
});
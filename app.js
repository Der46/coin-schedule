"use strict";

let DATA = [];
let currentSelected = null;
let dataLoaded = false;
let selectedCommand = "";
let currentLang = localStorage.getItem("coin999_lang") || "zh-Hant";
let I18N = {};
let SCHEDULE_DICTIONARIES = {};

const t = key => {
    const currentPack = I18N[currentLang] || {};
    const fallbackPack = I18N["zh-Hant"] || {};

    return currentPack[key] || fallbackPack[key] || key;
};

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
const installAppBtn = $("installAppBtn");
const mobileSidebar = $("mobileSidebar");
const mobileSidebarClose = $("mobileSidebarClose");
const sidebarOverlay = $("sidebarOverlay");

const pad2 = number => {
    const value = String(number);
    return value.length >= 2 ? value : `0${value}`;
};

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

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function getBrowserTimezoneOffsetMinutes() {
    return -new Date().getTimezoneOffset();
}

function getCurrentTimezoneOffsetMinutes() {
    if (hasOwn(LANGUAGE_TIMEZONE_OFFSET_MINUTES, currentLang)) {
        return LANGUAGE_TIMEZONE_OFFSET_MINUTES[currentLang];
    }

    return getBrowserTimezoneOffsetMinutes();
}

function isUsingBrowserTimezone() {
    return !hasOwn(LANGUAGE_TIMEZONE_OFFSET_MINUTES, currentLang);
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
    const timeParts = String(time).split(":").map(Number);
    const hour = timeParts[0];
    const minute = timeParts[1];

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
    const parts = String(time).split(":");
    const hour = parts[0];
    const minute = parts[1];

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

    Object.keys(dictionary)
        .sort((a, b) => b.length - a.length)
        .forEach(from => {
            const to = dictionary[from];
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

function applyI18n(options = {}) {
    const shouldRenderCurrentItem = hasOwn(options, "renderCurrentItem")
        ? options.renderCurrentItem
        : true;

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

    if (shouldRenderCurrentItem && currentSelected) {
        selectItem(currentSelected, false);
    }
}

function loadJsonFile(url, fallbackValue) {
    return fetch(url, { cache: "no-store" })
        .then(response => {
            if (!response.ok) {
                throw new Error(`${url} HTTP ${response.status}`);
            }

            return response.json();
        })
        .catch(error => {
            console.error(`[JSON Load Failed] ${url}`, error);
            return fallbackValue;
        });
}

function loadSettings() {
    return Promise.all([
        loadJsonFile("i18n.json", {}),
        loadJsonFile("schedule-dictionaries.json", {})
    ]).then(results => {
        const i18nData = results[0];
        const dictionaryData = results[1];

        I18N = i18nData && typeof i18nData === "object" ? i18nData : {};
        SCHEDULE_DICTIONARIES = dictionaryData && typeof dictionaryData === "object" ? dictionaryData : {};

        if (!I18N[currentLang]) {
            currentLang = "zh-Hant";
            localStorage.setItem("coin999_lang", currentLang);
        }
    });
}

function loadData() {
    detailEmpty.innerHTML = `
        <div class="loading-box">
            ${escapeHtml(t("loadingData"))}<br />
            ${escapeHtml(t("readingData"))} <strong>data.json</strong>
        </div>
    `;

    return loadJsonFile("data.json", null)
        .then(jsonData => {
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
            selectTodayForCurrentLanguageTimezone(false);
        })
        .catch(error => {
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
        });
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

    const scrollToDetail = hasOwn(options, "scrollToDetail")
        ? options.scrollToDetail
        : false;

    updateWeekdayButtons(command);
    selectItem(item, scrollToDetail);

    if (options.toastMessage) {
        showToast(options.toastMessage);
    }
}

function selectTodayForCurrentLanguageTimezone(showToastMessage = false) {
    const timezoneTodayCommand = getWeekdayCommandByDate();

    if (!dataLoaded) {
        updateWeekdayButtons(timezoneTodayCommand);
        return;
    }

    selectWeekdayCommand(timezoneTodayCommand, {
        scrollToDetail: false,
        toastMessage: showToastMessage
            ? `${t("switchedTo")}：${getCommandLabel(timezoneTodayCommand)}${t("activity")}｜${getTimezoneLabel()}`
            : ""
    });
}

const WEEK_MINUTES = 7 * 1440;
const DURATION_GROUP_RE = /^(.*?)\s*(\d+(?:\.\d+)?)\s*(mins?|分鐘|分|hrs?|h|小時)\s*$/i;
const PAREN_GROUP_RE = /[（(]([^（）()]*)[）)]/g;

const tf = (key, vars = {}) => t(key).replace(/\{(\w+)\}/g, (_, name) => (hasOwn(vars, name) ? vars[name] : ""));

const mod = (value, base) => ((value % base) + base) % base;

const minutesToClock = minutes => {
    const value = mod(Math.round(minutes), 1440);
    return `${pad2(Math.floor(value / 60))}:${pad2(value % 60)}`;
};

function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    const parts = [];

    if (hours) parts.push(tf("fmtHour", { n: hours }));
    if (mins || !hours) parts.push(tf("fmtMin", { n: mins }));

    return parts.join(" ");
}

// Splits "金槌🔨（1H）（備註）" into name / notes / duration minutes.
// A parenthesised group ending in a number + unit (H / Min / 小時 / 分) is the duration;
// any text in front of the number (e.g. 登入後) is kept as a note.
function parseEventText(text) {
    const value = String(text || "").trim();
    const notes = [];
    let durationMinutes = 0;
    let match;

    PAREN_GROUP_RE.lastIndex = 0;

    while ((match = PAREN_GROUP_RE.exec(value)) !== null) {
        const inside = match[1].trim();
        const duration = !durationMinutes && inside.match(DURATION_GROUP_RE);

        if (duration && duration[1].length <= 40) {
            const amount = Number(duration[2]);
            const isHour = /^(h|hrs?|小時)$/i.test(duration[3]);

            durationMinutes = Math.round(isHour ? amount * 60 : amount);

            if (duration[1].trim()) {
                notes.unshift(duration[1].trim());
            }
        } else if (inside) {
            notes.push(inside);
        }
    }

    const name = value
        .replace(PAREN_GROUP_RE, " ")
        .replace(/[（）()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return {
        name: name || value,
        notes,
        durationMinutes
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

const CATEGORY_ORDER = ["village", "coin", "hammer", "card", "mission", "default"];

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
        const info = parseEventText(text);
        const converted = convertSourceTimeToCurrentTimezone(sourceTime, item.command);
        const startMinute = converted.hour * 60 + converted.minute;
        const dayIndex = commandToIndex(converted.targetCommand);

        events.push({
            id: `${item.command}-${index}`,
            sourceCommand: item.command,
            sourceTime,
            time: converted.time,
            hour: converted.hour,
            minute: converted.minute,
            startMinute,
            weekStart: dayIndex * 1440 + startMinute,
            targetCommand: converted.targetCommand,
            dayShift: converted.dayShift,
            name: info.name,
            notes: info.notes,
            durationMinutes: info.durationMinutes,
            isDivider: /^[—–-]{2,}/.test(text),
            original: text,
            category: getEventCategory(text)
        });
    });

    return {
        header: headerLines.join(" "),
        events
    };
}

const compareEvents = (a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    if (a.isDivider !== b.isDivider) return a.isDivider ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
};

function getAllEvents() {
    const all = [];

    DATA.forEach(item => {
        parseScheduleDescriptionForSourceItem(item).events.forEach(event => all.push(event));
    });

    return all;
}

function getEventsForDisplayCommand(displayCommand, allEvents = getAllEvents()) {
    return allEvents
        .filter(event => event.targetCommand === displayCommand)
        .sort(compareEvents);
}

// Events from the previous day whose duration runs past midnight into this day.
function getCarryOverEvents(displayCommand, allEvents) {
    const previousCommand = indexToCommand(commandToIndex(displayCommand) - 1);

    return allEvents
        .filter(event =>
            event.targetCommand === previousCommand &&
            !event.isDivider &&
            event.durationMinutes > 0 &&
            event.startMinute + event.durationMinutes > 1440
        )
        .sort(compareEvents);
}

function getNowWeekMinute() {
    const now = getNowInCurrentTimezone();
    const dayIndex = (now.getDay() + 6) % 7;

    return dayIndex * 1440 + now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

// Live = now falls inside [start, start + duration), across the weekly cycle.
function getLiveInfo(event, nowWeekMinute) {
    if (!event.durationMinutes || event.isDivider) return null;

    const elapsed = mod(nowWeekMinute - event.weekStart, WEEK_MINUTES);

    if (elapsed >= event.durationMinutes) return null;

    return {
        elapsed,
        remaining: event.durationMinutes - elapsed,
        progress: elapsed / event.durationMinutes
    };
}

function getEventStatus(event, nowWeekMinute) {
    const live = getLiveInfo(event, nowWeekMinute);

    if (live) return { kind: "live", ...live };

    const startsIn = mod(event.weekStart - nowWeekMinute, WEEK_MINUTES);
    const sinceStart = WEEK_MINUTES - startsIn;

    if (sinceStart > 0 && sinceStart < 1440) {
        return event.durationMinutes ? { kind: "ended" } : { kind: "started", sinceStart };
    }

    return { kind: "upcoming", startsIn };
}

function readPref(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function writePref(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        /* storage unavailable: keep the in-memory value only */
    }
}

let activeFilter = readPref("coin999_filter", "all");
let hideEnded = readPref("coin999_hide_ended", "0") === "1";

function renderNotes(event) {
    const notes = event.notes.slice();

    if (event.dayShift !== 0) {
        notes.push(`${t("sourceTime")}：${getCommandLabel(event.sourceCommand)} ${event.sourceTime} UTC+08:00`);
    }

    if (!notes.length) return "";

    return `<div class="ev-notes">${notes.map(note => `<span class="ev-note">${escapeHtml(note)}</span>`).join("")}</div>`;
}

// A 24h mini track showing where in the day the event runs.
function renderTrack(event, live, offsetMinutes = 0) {
    if (!event.durationMinutes) return "";

    const start = event.startMinute - offsetMinutes;
    const end = start + event.durationMinutes;
    const left = Math.max(0, start) / 1440 * 100;
    const right = Math.min(1440, end) / 1440 * 100;

    const nowMarker = live
        ? `<i class="ev-track-now" style="left:${((start + live.elapsed) / 1440 * 100).toFixed(2)}%"></i>`
        : "";

    return `
        <div class="ev-track" aria-hidden="true">
            <span class="ev-track-bar" style="left:${left.toFixed(2)}%;width:${Math.max(right - left, 0.6).toFixed(2)}%"></span>
            ${nowMarker}
        </div>
    `;
}

function renderStatus(status) {
    if (!status) return "";

    if (status.kind === "live") {
        return `<span class="ev-status is-live"><i class="live-dot"></i>${escapeHtml(tf("liveCountdown", { t: formatDuration(Math.ceil(status.remaining)) }))}</span>`;
    }

    if (status.kind === "ended") {
        return `<span class="ev-status is-ended">${escapeHtml(t("endedLabel"))}</span>`;
    }

    if (status.kind === "started") {
        return `<span class="ev-status is-started">${escapeHtml(t("startedLabel"))}</span>`;
    }

    if (status.kind === "upcoming" && status.startsIn <= 180) {
        return `<span class="ev-status is-soon">${escapeHtml(tf("startsIn", { t: formatDuration(Math.ceil(status.startsIn)) }))}</span>`;
    }

    return "";
}

function renderEventItem(event, options = {}) {
    if (event.isDivider) {
        return `<li class="ev-divider"><span>${escapeHtml(event.time)}</span>${escapeHtml(event.name.replace(/^[—–-]+|[—–-]+$/g, "").trim())}</li>`;
    }

    const status = options.status || null;
    const live = status && status.kind === "live" ? status : null;
    const offset = options.carryOver ? 1440 : 0;
    const end = event.startMinute + event.durationMinutes;
    const crossesDay = end > 1440;

    const endHtml = event.durationMinutes
        ? `<span class="ev-end">→ ${escapeHtml(minutesToClock(end))}${crossesDay && !options.carryOver ? `<small>${escapeHtml(t("nextDay"))}</small>` : ""}</span>`
        : "";

    const durationHtml = event.durationMinutes
        ? `<span class="ev-dur">${escapeHtml(formatDuration(event.durationMinutes))}</span>`
        : `<span class="ev-dur is-unknown">${escapeHtml(t("durationUnknown"))}</span>`;

    const classes = [
        "ev",
        `cat-${event.category}`,
        status ? `is-${status.kind}` : "",
        event.durationMinutes ? "" : "no-duration"
    ].filter(Boolean).join(" ");

    const startLabel = options.carryOver
        ? `<small>${escapeHtml(t("previousDayShort"))}</small>${escapeHtml(event.time)}`
        : escapeHtml(event.time);

    return `
        <li class="${classes}">
            <div class="ev-time">
                <span class="ev-start">${startLabel}</span>
                ${endHtml}
            </div>
            <div class="ev-body">
                <div class="ev-head">
                    <span class="event-badge ${escapeHtml(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
                    <span class="ev-name">${escapeHtml(event.name)}</span>
                </div>
                ${renderNotes(event)}
                ${renderTrack(event, live, offset)}
            </div>
            <div class="ev-side">
                ${durationHtml}
                ${renderStatus(status)}
                <button type="button" class="ev-cal-btn" data-ev-id="${escapeHtml(event.id)}" aria-label="${escapeHtml(`${t("addToCalendar")}：${event.name}`)}" title="${escapeHtml(t("addToCalendar"))}">🔔</button>
            </div>
        </li>
    `;
}

/* ---------- Add to calendar (.ics / Google Calendar) ---------- */

// Events without a stated duration get a 1-minute slot: no made-up duration,
// and iOS refuses .ics events whose start equals their end.
const CAL_EVENT_FALLBACK_MINUTES = 1;
const CAL_ICS_PATH = "./calendar.ics";

let calDialogEvent = null;

function isAppleMobileDevice() {
    const ua = window.navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
}

function isInAppBrowser() {
    return /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(window.navigator.userAgent);
}

// Next real start (UTC ms) of an event, from its original UTC+8 weekday/time.
function getNextEventStartMs(event) {
    const parts = event.sourceTime.split(":").map(Number);
    const sourceMinute = parts[0] * 60 + parts[1];
    const offsetMs = SOURCE_TIMEZONE_OFFSET_MINUTES * 60000;
    const weekMs = WEEK_MINUTES * 60000;
    const nowMs = Date.now();
    const sourceNow = new Date(nowMs + offsetMs);
    const sourceDayIndex = (sourceNow.getUTCDay() + 6) % 7;
    const sourceMidnightMs = Date.UTC(sourceNow.getUTCFullYear(), sourceNow.getUTCMonth(), sourceNow.getUTCDate()) - offsetMs;
    const dayDelta = commandToIndex(event.sourceCommand) - sourceDayIndex;

    let startMs = sourceMidnightMs + (dayDelta * 1440 + sourceMinute) * 60000;

    while (startMs <= nowMs) startMs += weekMs;
    while (startMs - weekMs > nowMs) startMs -= weekMs;

    return startMs;
}

const toCalendarUtc = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeIcsText = text => String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function foldIcsLine(line) {
    const encoder = new TextEncoder();
    const chunks = [];
    let current = "";
    let bytes = 0;

    for (const char of line) {
        const size = encoder.encode(char).length;

        if (bytes + size > (chunks.length ? 74 : 75)) {
            chunks.push(current);
            current = "";
            bytes = 0;
        }

        current += char;
        bytes += size;
    }

    chunks.push(current);
    return chunks.join("\r\n ");
}

function hashText(text) {
    let hash = 0;

    for (const char of String(text)) {
        hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    }

    return hash.toString(36);
}

function getCalendarDetails(event) {
    const parts = [];

    if (event.notes.length) parts.push(event.notes.join(" · "));
    parts.push(event.durationMinutes ? tf("lastsFor", { t: formatDuration(event.durationMinutes) }) : t("durationUnknown"));
    parts.push(`${t("sourceTime")}：${getCommandLabel(event.sourceCommand)} ${event.sourceTime} UTC+08:00`);
    parts.push(`${t("pageTitle")}：${window.location.origin}${window.location.pathname}`);

    return parts.join("\n");
}

function getCalendarRange(event) {
    const startMs = getNextEventStartMs(event);
    const minutes = event.durationMinutes || CAL_EVENT_FALLBACK_MINUTES;

    return { startMs, endMs: startMs + minutes * 60000 };
}

function buildIcs(event, repeatWeekly) {
    const range = getCalendarRange(event);
    const uid = `${event.sourceCommand.replace(/\W/g, "")}-${event.sourceTime.replace(":", "")}-${hashText(event.original)}@coin999-schedule`;

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Coin999//Schedule//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toCalendarUtc(Date.now())}`,
        `DTSTART:${toCalendarUtc(range.startMs)}`,
        `DTEND:${toCalendarUtc(range.endMs)}`,
        repeatWeekly ? "RRULE:FREQ=WEEKLY" : "",
        `SUMMARY:${escapeIcsText(event.name)}`,
        `DESCRIPTION:${escapeIcsText(getCalendarDetails(event))}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcsText(event.name)}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ].filter(Boolean);

    return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

function buildGoogleCalendarUrl(event, repeatWeekly) {
    const range = getCalendarRange(event);
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.name,
        dates: `${toCalendarUtc(range.startMs)}/${toCalendarUtc(range.endMs)}`,
        details: getCalendarDetails(event)
    });

    if (repeatWeekly) params.set("recur", "RRULE:FREQ=WEEKLY");

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toBase64Url(text) {
    let binary = "";

    new TextEncoder().encode(text).forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deliverIcs(ics, filename) {
    // iOS opens the "Add to Calendar" sheet for a navigated text/calendar
    // response, so serve it from a same-origin URL via the service worker
    // (falls back to a data: URL before the worker controls the page).
    if (isAppleMobileDevice()) {
        const controlled = "serviceWorker" in navigator && navigator.serviceWorker.controller;

        window.location.href = controlled
            ? `${CAL_ICS_PATH}?name=${encodeURIComponent(filename)}&d=${toBase64Url(ics)}`
            : `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
        return;
    }

    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);

    showToast(t("calDownloaded"));
}

function getCalendarLocalTimeLabel(event) {
    const date = new Date(getNextEventStartMs(event));

    try {
        return new Intl.DateTimeFormat(currentLang, {
            month: "numeric",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(date);
    } catch (error) {
        return date.toLocaleString();
    }
}

function renderCalendarDialog() {
    const dialog = $("calDialog");
    const event = calDialogEvent;

    if (!dialog || !event) return;

    const repeatWeekly = readPref("coin999_cal_repeat", "1") === "1";
    const appleFirst = isAppleMobileDevice();

    const appleBtn = `<button type="button" class="cal-action${appleFirst ? " is-primary" : ""}" data-cal="ics">${escapeHtml(t("calApple"))}</button>`;
    const googleBtn = `<button type="button" class="cal-action${appleFirst ? "" : " is-primary"}" data-cal="google">${escapeHtml(t("calGoogle"))}</button>`;

    dialog.innerHTML = `
        <div class="cal-sheet">
            <div class="cal-head">
                <h2 id="calDialogTitle">${escapeHtml(t("addToCalendar"))}</h2>
                <button type="button" class="cal-close" data-cal="close" aria-label="${escapeHtml(t("close"))}">×</button>
            </div>
            <div class="cal-event">
                <div class="cal-event-name">
                    <span class="event-badge ${escapeHtml(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
                    <strong>${escapeHtml(event.name)}</strong>
                </div>
                <span class="cal-when">${escapeHtml(tf("calLocalTime", { time: getCalendarLocalTimeLabel(event) }))}</span>
                <span class="cal-when">${escapeHtml(event.durationMinutes ? tf("lastsFor", { t: formatDuration(event.durationMinutes) }) : t("durationUnknown"))}</span>
            </div>
            <label class="cal-repeat">
                <input type="checkbox" id="calRepeatInput" ${repeatWeekly ? "checked" : ""} />
                <span>${escapeHtml(t("calRepeatWeekly"))}</span>
            </label>
            <div class="cal-actions">${appleFirst ? appleBtn + googleBtn : googleBtn + appleBtn}</div>
            <ul class="cal-hints">
                ${isInAppBrowser() ? `<li class="is-warn">${escapeHtml(t("calInAppHint"))}</li>` : ""}
                <li>${escapeHtml(t("calAlarmHint"))}</li>
                <li>${escapeHtml(t("calGoogleHint"))}</li>
                <li>${escapeHtml(t("calStaleHint"))}</li>
            </ul>
        </div>
    `;

    const repeatInput = $("calRepeatInput");

    if (repeatInput) {
        repeatInput.addEventListener("change", () => {
            writePref("coin999_cal_repeat", repeatInput.checked ? "1" : "0");
        });
    }
}

function openCalendarDialog(eventId) {
    const dialog = $("calDialog");
    const event = getAllEvents().find(item => item.id === eventId && !item.isDivider);

    if (!dialog || !event) return;

    calDialogEvent = event;
    renderCalendarDialog();

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        dialog.setAttribute("open", "");
    }
}

function closeCalendarDialog() {
    const dialog = $("calDialog");

    if (!dialog) return;

    if (typeof dialog.close === "function") {
        if (dialog.open) dialog.close();
    } else {
        dialog.removeAttribute("open");
    }
}

function handleCalendarDialogClick(clickEvent) {
    const dialog = $("calDialog");

    // A click on the backdrop (the dialog box itself, outside the sheet) closes it.
    if (clickEvent.target === dialog) {
        closeCalendarDialog();
        return;
    }

    const button = clickEvent.target.closest("[data-cal]");

    if (!button || !calDialogEvent) return;

    const repeatInput = $("calRepeatInput");
    const repeatWeekly = repeatInput ? repeatInput.checked : true;
    const action = button.dataset.cal;

    if (action === "close") {
        closeCalendarDialog();
        return;
    }

    if (action === "google") {
        window.open(buildGoogleCalendarUrl(calDialogEvent, repeatWeekly), "_blank", "noopener");
        closeCalendarDialog();
        return;
    }

    if (action === "ics") {
        const filename = `coin999-${calDialogEvent.sourceCommand.replace(/\W/g, "")}-${calDialogEvent.sourceTime.replace(":", "")}.ics`;

        closeCalendarDialog();
        deliverIcs(buildIcs(calDialogEvent, repeatWeekly), filename);
    }
}

function renderNowCard(allEvents = getAllEvents()) {
    const nowCard = $("nowCard");

    if (!nowCard || !dataLoaded) return;

    const nowWeekMinute = getNowWeekMinute();
    const nowClock = minutesToClock(Math.floor(mod(nowWeekMinute, 1440)));
    const realEvents = allEvents.filter(event => !event.isDivider);
    const todayCommand = getWeekdayCommandByDate();

    const liveEvents = realEvents
        .map(event => ({ event, live: getLiveInfo(event, nowWeekMinute) }))
        .filter(entry => entry.live)
        .sort((a, b) => a.live.remaining - b.live.remaining);

    const justStarted = realEvents
        .filter(event => !event.durationMinutes)
        .map(event => ({ event, since: mod(nowWeekMinute - event.weekStart, WEEK_MINUTES) }))
        .filter(entry => entry.since < 60)
        .sort((a, b) => a.since - b.since);

    const upcomingAll = realEvents
        .map(event => ({ event, startsIn: mod(event.weekStart - nowWeekMinute, WEEK_MINUTES) }))
        .filter(entry => entry.startsIn > 0)
        .sort((a, b) => a.startsIn - b.startsIn);

    const nextStarts = [...new Set(upcomingAll.map(entry => entry.event.weekStart))].slice(0, 2);
    const upcoming = upcomingAll.filter(entry => nextStarts.includes(entry.event.weekStart)).slice(0, 6);

    const liveHtml = liveEvents.length
        ? liveEvents.map(({ event, live }) => `
            <li class="now-item">
                <div class="now-item-top">
                    <span class="event-badge ${escapeHtml(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
                    <span class="now-item-name">${escapeHtml(event.name)}</span>
                    <span class="now-item-left">${escapeHtml(tf("liveCountdown", { t: formatDuration(Math.ceil(live.remaining)) }))}</span>
                </div>
                <div class="now-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(live.progress * 100)}">
                    <span style="width:${(live.progress * 100).toFixed(1)}%"></span>
                </div>
                <div class="now-item-range">${escapeHtml(event.targetCommand !== todayCommand ? `${t(`${WEEKDAY_I18N_KEYS[commandToIndex(event.targetCommand)]}Short`)} ` : "")}${escapeHtml(event.time)} → ${escapeHtml(minutesToClock(event.startMinute + event.durationMinutes))}${event.startMinute + event.durationMinutes > 1440 ? ` (${escapeHtml(t("nextDay"))})` : ""} · ${escapeHtml(formatDuration(event.durationMinutes))}</div>
            </li>
        `).join("")
        : `<li class="now-empty">${escapeHtml(t("noLive"))}</li>`;

    const startedHtml = justStarted.length
        ? `
            <div class="now-subtitle is-muted">${escapeHtml(t("justStarted"))}</div>
            <ul class="now-chips">
                ${justStarted.map(({ event }) => `<li><b>${escapeHtml(event.time)}</b>${escapeHtml(event.name)}</li>`).join("")}
            </ul>
        `
        : "";

    const upcomingHtml = upcoming.map(({ event, startsIn }) => `
        <li class="next-item">
            <span class="next-time">${event.targetCommand !== todayCommand ? `<small>${escapeHtml(t(`${WEEKDAY_I18N_KEYS[commandToIndex(event.targetCommand)]}Short`))}</small>` : ""}${escapeHtml(event.time)}</span>
            <div class="next-body">
                <div class="next-head">
                    <span class="event-badge ${escapeHtml(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
                    <span class="next-name">${escapeHtml(event.name)}</span>
                </div>
                <span class="next-meta">${escapeHtml(tf("startsIn", { t: formatDuration(Math.ceil(startsIn)) }))} · ${escapeHtml(event.durationMinutes ? tf("lastsFor", { t: formatDuration(event.durationMinutes) }) : t("durationUnknown"))}</span>
            </div>
        </li>
    `).join("");

    nowCard.innerHTML = `
        <div class="now-header">
            <h2>${escapeHtml(t("nowTitle"))}<span class="now-clock">${escapeHtml(nowClock)}</span></h2>
            <span class="now-tz">${escapeHtml(getWeekdayNameByDate())} · ${escapeHtml(getTimezoneLabel())}</span>
        </div>
        <div class="now-grid">
            <section class="now-col">
                <div class="now-subtitle"><i class="live-dot"></i>${escapeHtml(t("liveNow"))}<span class="now-count">${liveEvents.length}</span></div>
                <ul class="now-list">${liveHtml}</ul>
                ${startedHtml}
            </section>
            <section class="now-col">
                <div class="now-subtitle">${escapeHtml(t("startingSoon"))}</div>
                <ul class="next-list">${upcomingHtml}</ul>
            </section>
        </div>
    `;
}

function renderScheduleView(item) {
    const displayCommand = selectedCommand || item.command;
    const allEvents = getAllEvents();
    const eventsForDisplay = getEventsForDisplayCommand(displayCommand, allEvents);
    const carryOver = getCarryOverEvents(displayCommand, allEvents);

    renderNowCard(allEvents);

    if (!eventsForDisplay.length && !carryOver.length) {
        scheduleView.innerHTML = `<div class="no-result">${escapeHtml(t("noSchedule"))}</div>`;
        return;
    }

    const isSelectedToday = displayCommand === getWeekdayCommandByDate();
    const nowWeekMinute = getNowWeekMinute();
    const nowDayMinute = mod(nowWeekMinute, 1440);
    const nowMarkerHtml = `<li class="now-marker"><span>${escapeHtml(tf("nowMarker", { time: minutesToClock(Math.floor(nowDayMinute)) }))}</span></li>`;

    const presentCategories = CATEGORY_ORDER.filter(category =>
        eventsForDisplay.some(event => !event.isDivider && event.category === category)
    );

    if (activeFilter !== "all" && !presentCategories.includes(activeFilter)) {
        activeFilter = "all";
    }

    const matchesFilter = event => activeFilter === "all" || event.isDivider || event.category === activeFilter;
    const isHidden = status => hideEnded && status && status.kind === "ended";

    const visible = eventsForDisplay
        .map(event => ({
            event,
            status: isSelectedToday && !event.isDivider ? getEventStatus(event, nowWeekMinute) : null
        }))
        .filter(({ event, status }) => matchesFilter(event) && !isHidden(status));

    const visibleCarryOver = carryOver
        .filter(matchesFilter)
        .map(event => {
            const live = isSelectedToday ? getLiveInfo(event, nowWeekMinute) : null;
            return {
                event,
                status: isSelectedToday ? (live ? { kind: "live", ...live } : { kind: "ended" }) : null
            };
        })
        .filter(({ status }) => !isHidden(status));

    const listParts = [];
    let markerInserted = !isSelectedToday;

    visible.forEach(({ event, status }) => {
        if (!markerInserted && event.startMinute > nowDayMinute) {
            listParts.push(nowMarkerHtml);
            markerInserted = true;
        }

        listParts.push(renderEventItem(event, { status }));
    });

    if (!markerInserted && visible.length) {
        listParts.push(nowMarkerHtml);
    }

    const carryHtml = visibleCarryOver.length
        ? `
            <div class="ev-group-title">${escapeHtml(t("carryOver"))}</div>
            <ul class="ev-list is-carry">${visibleCarryOver.map(({ event, status }) => renderEventItem(event, { status, carryOver: true })).join("")}</ul>
        `
        : "";

    const realEvents = eventsForDisplay.filter(event => !event.isDivider);
    const realCount = realEvents.length;
    const timedCount = realEvents.filter(event => event.durationMinutes).length;
    const updateText = getUpdateText(getItemDescription(item));

    const chips = ["all", ...presentCategories].map(category => {
        const label = category === "all" ? t("filterAll") : getCategoryLabel(category);
        const count = category === "all"
            ? realCount
            : realEvents.filter(event => event.category === category).length;
        const isActive = activeFilter === category;

        return `<button type="button" class="filter-chip cat-${category}${isActive ? " active" : ""}" data-filter="${category}" aria-pressed="${isActive}">${escapeHtml(label)}<span>${count}</span></button>`;
    }).join("");

    scheduleView.innerHTML = `
        <div class="schedule-meta">
            <span>${escapeHtml(tf("eventsCount", { n: realCount }))}</span>
            <span>${escapeHtml(tf("timedCount", { n: timedCount }))}</span>
            <span>${escapeHtml(getTimezoneLabel())}</span>
            ${updateText ? `<span>${escapeHtml(updateText)}</span>` : ""}
        </div>

        <div class="schedule-toolbar">
            <div class="filter-chips" role="group">${chips}</div>
            ${isSelectedToday ? `
                <label class="hide-ended-toggle">
                    <input type="checkbox" id="hideEndedInput" ${hideEnded ? "checked" : ""} />
                    <span>${escapeHtml(t("hideEnded"))}</span>
                </label>
            ` : ""}
        </div>

        ${carryHtml}
        <ul class="ev-list">${listParts.join("") || `<li class="no-result">${escapeHtml(t("noMatch"))}</li>`}</ul>
    `;

    scheduleView.querySelectorAll(".filter-chip").forEach(button => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;
            writePref("coin999_filter", activeFilter);
            renderScheduleView(item);
        });
    });

    const hideEndedInput = $("hideEndedInput");

    if (hideEndedInput) {
        hideEndedInput.addEventListener("change", () => {
            hideEnded = hideEndedInput.checked;
            writePref("coin999_hide_ended", hideEnded ? "1" : "0");
            renderScheduleView(item);
        });
    }
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

function refreshLiveViews() {
    if (!dataLoaded || !currentSelected || document.hidden) return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#scheduleView")) {
        renderNowCard();
        return;
    }

    updateWeekdayButtons(selectedCommand);
    renderScheduleView(currentSelected);
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

            applyI18n({
                renderCurrentItem: false
            });

            selectTodayForCurrentLanguageTimezone(true);
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

    if (installAppBtn) {
        installAppBtn.addEventListener("click", handleInstallAppClick);
    }

    if (mobileSidebarClose) {
        mobileSidebarClose.addEventListener("click", closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeSidebar);
    }

    if (scheduleView) {
        scheduleView.addEventListener("click", clickEvent => {
            const button = clickEvent.target.closest(".ev-cal-btn");

            if (button) openCalendarDialog(button.dataset.evId);
        });
    }

    const calDialog = $("calDialog");

    if (calDialog) {
        calDialog.addEventListener("click", handleCalendarDialogClick);
    }

    document.querySelectorAll(".mobile-tool-nav a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    // Keep live countdowns / statuses fresh.
    window.setInterval(refreshLiveViews, 30000);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshLiveViews();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    loadSettings()
        .then(() => {
            if (languageSelect) {
                languageSelect.value = currentLang;
            }

            applyI18n();
            bindEvents();

            return loadData();
        })
        .catch(error => {
            console.error("[App Init Failed]", error);
        });
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(error => {
            console.error("Service Worker registration failed:", error);
        });
    });
}
let deferredInstallPrompt = null;

function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isSafariBrowser() {
    return /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
}

function showInstallButton() {
    if (!installAppBtn) return;

    if (isStandaloneMode()) {
        installAppBtn.classList.remove("is-visible");
        return;
    }

    installAppBtn.classList.add("is-visible");
}

function hideInstallButton() {
    if (!installAppBtn) return;

    installAppBtn.classList.remove("is-visible");
}

async function handleInstallAppClick() {
    if (isStandaloneMode()) {
        hideInstallButton();
        return;
    }

    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();

        const choiceResult = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;

        if (choiceResult.outcome === "accepted") {
            hideInstallButton();
            showToast(t("installingApp"));
        }

        return;
    }

    if (isIosDevice() && isSafariBrowser()) {
        showToast(t("iosInstallHint"));
        return;
    }

    showToast(t("browserInstallHint"));
}

window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();

    deferredInstallPrompt = event;
    showInstallButton();
});

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallButton();
    showToast(t("appInstalled"));
});

window.addEventListener("load", () => {
    if (isStandaloneMode()) {
        hideInstallButton();
        return;
    }

    if (isIosDevice() && isSafariBrowser()) {
        showInstallButton();
    }
});

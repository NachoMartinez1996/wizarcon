import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, onValue, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const HOUSE_ORDER = ["Gryffindor", "Hufflepuff", "Ravenclaw", "Slytherin"];
const HOUSE_ICONS = {
    Gryffindor: "🦁",
    Hufflepuff: "🦡",
    Ravenclaw: "🦅",
    Slytherin: "🐍",
};
const HOUSE_THEME_META = {
    Gryffindor: "#740001",
    Hufflepuff: "#ecb939",
    Ravenclaw: "#0e1a40",
    Slytherin: "#1a472a",
};
const SHARE_CARD_THEMES = {
    Gryffindor: {
        primary: "#740001",
        secondary: "#d3a625",
        shadow: "#260001",
        textOnSecondary: "#201209",
    },
    Hufflepuff: {
        primary: "#101010",
        secondary: "#ecb939",
        shadow: "#000000",
        textOnSecondary: "#14110a",
    },
    Ravenclaw: {
        primary: "#0e1a40",
        secondary: "#946b2d",
        shadow: "#040a18",
        textOnSecondary: "#ffffff",
    },
    Slytherin: {
        primary: "#1a472a",
        secondary: "#c0c0c0",
        shadow: "#06140c",
        textOnSecondary: "#111111",
    },
};
const SHARE_CARD_SIZE = {
    width: 1080,
    height: 1350,
};
const DEFAULT_CUP_HISTORY = [
    { copa: 1, anio: "2012", ganador: "Slytherin" },
    { copa: 2, anio: "2013", ganador: "Gryffindor" },
    { copa: 3, anio: "2014", ganador: "Gryffindor" },
    { copa: 4, anio: "2015", ganador: "Ravenclaw" },
    { copa: 5, anio: "2016", ganador: "Slytherin" },
    { copa: 6, anio: "2017", ganador: "Ravenclaw" },
    { copa: 7, anio: "2018", ganador: "Ravenclaw" },
    { copa: 8, anio: "2019", ganador: "Gryffindor" },
    { copa: 9, anio: "2020", ganador: "Gryffindor" },
    { copa: 10, anio: "2021", ganador: "Gryffindor" },
    { copa: 11, anio: "2022", ganador: "Gryffindor" },
    { copa: 12, anio: "2023-2024", ganador: "Ravenclaw" },
    { copa: 13, anio: "2025", ganador: "Ravenclaw" },
];

const ALL_ACTIVITIES_FILTER = "__all__";
const CUP_HISTORY_HASH = "#copas";
const CEREMONY_HASH = "#ceremonia";
const PENDING_STATE_KEY = "wizarcon_copa_pending_state";
const LAST_SYNCED_STATE_KEY = "wizarcon_copa_last_synced_state";

const loadingOverlayEl = document.getElementById("loading-overlay");
const statusBannerEl = document.getElementById("status-banner");
const vistaCopaEl = document.getElementById("vista-copa");
const vistaHistorialCopasEl = document.getElementById("vista-historial-copas");
const vistaCeremoniaEl = document.getElementById("vista-ceremonia");
const ceremoniaContenidoEl = document.getElementById("ceremonia-contenido");
const selectActividadEl = document.getElementById("select-actividad");
const puntosInputEl = document.getElementById("puntos-input");
const tablaPosicionesEl = document.getElementById("tabla-posiciones");
const copaActualResumenEl = document.getElementById("copa-actual-resumen");
const tablaCopasEl = document.getElementById("tabla-copas");
const estadisticasCopasEl = document.getElementById("estadisticas-copas");
const detalleCopaEl = document.getElementById("detalle-copa");
const historialEl = document.getElementById("lista-historial");
const filtroHistorialEl = document.getElementById("filtro-historial");
const listaActividadesEl = document.getElementById("lista-actividades");
const nuevaActividadEl = document.getElementById("nueva-act-nombre");
const themeColorMetaEl = document.querySelector("meta[name=\"theme-color\"]");

const firebaseConfig = {
    apiKey: "AIzaSyAiG3c-wxi7ugArZc0ScZRzWe6cI2pSl4U",
    authDomain: "copa-wizarcon.firebaseapp.com",
    databaseURL: "https://copa-wizarcon-default-rtdb.firebaseio.com/",
    projectId: "copa-wizarcon",
    storageBucket: "copa-wizarcon.firebasestorage.app",
    messagingSenderId: "177951654125",
    appId: "1:177951654125:web:51ee03a5ad4ef059484ce4",
    measurementId: "G-TSJCCLHWRY",
};

function createZeroScores() {
    return {
        Gryffindor: 0,
        Hufflepuff: 0,
        Ravenclaw: 0,
        Slytherin: 0,
    };
}

function cloneScores(scores = {}) {
    const cloned = createZeroScores();

    HOUSE_ORDER.forEach((casa) => {
        cloned[casa] = Number.parseInt(scores[casa], 10) || 0;
    });

    return cloned;
}

function normalizeScoreMap(scores) {
    if (!scores || typeof scores !== "object") {
        return null;
    }

    const normalized = createZeroScores();
    let hasScoreData = false;

    HOUSE_ORDER.forEach((casa) => {
        if (Object.prototype.hasOwnProperty.call(scores, casa)) {
            hasScoreData = true;
        }

        normalized[casa] = Number.parseInt(scores[casa], 10) || 0;
    });

    return hasScoreData ? normalized : null;
}

function createDefaultCupHistory() {
    return DEFAULT_CUP_HISTORY.map((copa) => ({ ...copa }));
}

function createDefaultState() {
    return {
        bases: createZeroScores(),
        actividades: ["General"],
        puntosEvento: createZeroScores(),
        historial: [],
        copas: createDefaultCupHistory(),
    };
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[char]));
}

function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const casa = HOUSE_ORDER.includes(entry.casa) ? entry.casa : HOUSE_ORDER[0];
    const puntos = Number.parseInt(entry.puntos, 10);

    return {
        casa,
        puntos: Number.isNaN(puntos) ? 0 : puntos,
        actividad: String(entry.actividad ?? "General").trim() || "General",
        fecha: String(entry.fecha ?? entry.dia ?? "").trim(),
        fechaISO: String(entry.fechaISO ?? "").trim(),
        hora: String(entry.hora ?? "").trim() || "--:--",
    };
}

function normalizeCupEntry(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const copa = Number.parseInt(entry.copa, 10);
    const anio = String(entry.anio ?? entry.año ?? entry.year ?? "").trim();
    const ganador = HOUSE_ORDER.includes(entry.ganador) ? entry.ganador : "";

    if (!Number.isInteger(copa) || copa <= 0 || !anio || !ganador) {
        return null;
    }

    const normalized = { copa, anio, ganador };
    const puntajesFinales = normalizeScoreMap(entry.puntajesFinales ?? entry.puntajes ?? entry.puntos);
    const bases = normalizeScoreMap(entry.bases);
    const puntosEvento = normalizeScoreMap(entry.puntosEvento);

    if (puntajesFinales) {
        normalized.puntajesFinales = puntajesFinales;
    }

    if (bases) {
        normalized.bases = bases;
    }

    if (puntosEvento) {
        normalized.puntosEvento = puntosEvento;
    }

    if (Array.isArray(entry.actividades)) {
        normalized.actividades = [...new Set(
            entry.actividades
                .map((actividad) => String(actividad ?? "").trim())
                .filter(Boolean),
        )];
    }

    if (Array.isArray(entry.historial)) {
        normalized.historial = entry.historial
            .map((registro) => normalizeHistoryEntry(registro))
            .filter(Boolean);
    }

    const fechaFinalizacion = String(entry.fechaFinalizacion ?? entry.cerradaEn ?? "").trim();
    if (fechaFinalizacion) {
        normalized.fechaFinalizacion = fechaFinalizacion;
    }

    return normalized;
}

function normalizeState(data) {
    const normalized = createDefaultState();

    if (!data || typeof data !== "object") {
        return normalized;
    }

    if (data.bases && typeof data.bases === "object") {
        HOUSE_ORDER.forEach((casa) => {
            normalized.bases[casa] = Number.parseInt(data.bases[casa], 10) || 0;
        });
    }

    if (data.puntosEvento && typeof data.puntosEvento === "object") {
        HOUSE_ORDER.forEach((casa) => {
            normalized.puntosEvento[casa] = Number.parseInt(data.puntosEvento[casa], 10) || 0;
        });
    }

    if (Array.isArray(data.actividades)) {
        const actividades = [...new Set(
            data.actividades
                .map((actividad) => String(actividad ?? "").trim())
                .filter(Boolean),
        )];

        if (actividades.length > 0) {
            normalized.actividades = actividades;
        }
    }

    if (Array.isArray(data.historial)) {
        normalized.historial = data.historial
            .map((entry) => normalizeHistoryEntry(entry))
            .filter(Boolean);
    }

    const copasData = Array.isArray(data.copas)
        ? data.copas
        : Array.isArray(data.historialCopas)
            ? data.historialCopas
            : null;

    if (copasData) {
        const copas = copasData
            .map((entry) => normalizeCupEntry(entry))
            .filter(Boolean)
            .sort((a, b) => a.copa - b.copa);

        if (copas.length > 0) {
            normalized.copas = copas;
        }
    }

    return normalized;
}

function getTotalPoints(casa) {
    return db.bases[casa] + db.puntosEvento[casa];
}

function getScoreSnapshot(state = db) {
    const scores = createZeroScores();

    HOUSE_ORDER.forEach((casa) => {
        scores[casa] = (Number.parseInt(state.bases?.[casa], 10) || 0)
            + (Number.parseInt(state.puntosEvento?.[casa], 10) || 0);
    });

    return scores;
}

function getOrderedCups(copas = db.copas) {
    return [...copas].sort((a, b) => a.copa - b.copa);
}

function getLatestCup() {
    return getOrderedCups().at(-1) ?? null;
}

function getNextCupNumber() {
    const maxCup = getOrderedCups().reduce((max, copa) => Math.max(max, copa.copa), 0);
    return maxCup + 1;
}

function getLeaderInfo(scores = getScoreSnapshot()) {
    const maxScore = Math.max(...HOUSE_ORDER.map((casa) => scores[casa]));
    const leaders = HOUSE_ORDER.filter((casa) => scores[casa] === maxScore);
    const hasPoints = HOUSE_ORDER.some((casa) => scores[casa] !== 0);

    return {
        maxScore,
        leaders,
        hasPoints,
        winner: leaders.length === 1 ? leaders[0] : null,
    };
}

function formatHouseName(casa) {
    return `${HOUSE_ICONS[casa]} ${casa}`;
}

function formatHouseList(casas) {
    if (casas.length <= 1) {
        return casas[0] ? formatHouseName(casas[0]) : "Sin datos";
    }

    const formatted = casas.map((casa) => formatHouseName(casa));
    return `${formatted.slice(0, -1).join(", ")} y ${formatted.at(-1)}`;
}

function formatCupCount(count) {
    return count === 1 ? "1 copa" : `${count} copas`;
}

function formatCupSpan(streak) {
    if (!streak?.start || !streak?.end) {
        return "";
    }

    return streak.start.copa === streak.end.copa
        ? streak.start.anio
        : `${streak.start.anio} a ${streak.end.anio}`;
}

function getCupStats(copas = db.copas) {
    const orderedCups = getOrderedCups(copas);
    const winsByHouse = createZeroScores();

    orderedCups.forEach((copa) => {
        winsByHouse[copa.ganador] += 1;
    });

    const maxWins = Math.max(...HOUSE_ORDER.map((casa) => winsByHouse[casa]));
    const topHouses = maxWins > 0 ? HOUSE_ORDER.filter((casa) => winsByHouse[casa] === maxWins) : [];
    const streaks = [];
    let currentStreak = null;

    orderedCups.forEach((copa) => {
        if (currentStreak?.casa === copa.ganador) {
            currentStreak.count += 1;
            currentStreak.end = copa;
        } else {
            currentStreak = {
                casa: copa.ganador,
                count: 1,
                start: copa,
                end: copa,
            };
            streaks.push(currentStreak);
        }
    });

    const bestStreakCount = Math.max(0, ...streaks.map((streak) => streak.count));
    const bestStreaks = streaks.filter((streak) => streak.count === bestStreakCount);

    return {
        orderedCups,
        winsByHouse,
        maxWins,
        topHouses,
        bestStreakCount,
        bestStreaks,
        activeStreak: streaks.at(-1) ?? null,
    };
}

function getThemeHouse() {
    const currentLeader = getLeaderInfo();

    if (currentLeader.hasPoints && currentLeader.winner) {
        return currentLeader.winner;
    }

    return getLatestCup()?.ganador ?? null;
}

function applyHouseTheme() {
    const themeHouse = getThemeHouse();

    HOUSE_ORDER.forEach((casa) => {
        document.body.classList.remove(`house-${casa.toLowerCase()}`);
    });

    if (themeHouse) {
        document.body.classList.add(`house-${themeHouse.toLowerCase()}`);
    }

    themeColorMetaEl?.setAttribute("content", HOUSE_THEME_META[themeHouse] ?? "#121212");
}

function buildCurrentCupSummary(leaderInfo) {
    if (leaderInfo.hasPoints && leaderInfo.winner) {
        return `Va ganando ${formatHouseName(leaderInfo.winner)} con ${leaderInfo.maxScore} pts`;
    }

    if (leaderInfo.hasPoints) {
        return `Empate en la punta: ${formatHouseList(leaderInfo.leaders)} (${leaderInfo.maxScore} pts)`;
    }

    const latestCup = getLatestCup();
    if (latestCup) {
        return `Última copa: ${formatHouseName(latestCup.ganador)} (${latestCup.anio})`;
    }

    return "Copa sin puntos cargados";
}

function getScoreRowsFromMap(scores) {
    return HOUSE_ORDER
        .map((casa) => ({
            casa,
            puntos: Number.parseInt(scores?.[casa], 10) || 0,
        }))
        .sort((a, b) => {
            const scoreDiff = b.puntos - a.puntos;
            return scoreDiff || HOUSE_ORDER.indexOf(a.casa) - HOUSE_ORDER.indexOf(b.casa);
        });
}

function getCardTheme(casa) {
    return SHARE_CARD_THEMES[casa] ?? SHARE_CARD_THEMES.Ravenclaw;
}

function sanitizeFilePart(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "copa";
}

function getShareDateLabel() {
    return new Date().toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function getCurrentShareCardData() {
    const scores = getScoreSnapshot();
    const rows = getScoreRowsFromMap(scores);
    const leaderInfo = getLeaderInfo(scores);
    const themeHouse = leaderInfo.winner ?? getThemeHouse() ?? rows[0]?.casa ?? HOUSE_ORDER[0];
    const status = leaderInfo.winner
        ? `Va ganando ${leaderInfo.winner}`
        : leaderInfo.hasPoints
            ? "Empate en la punta"
            : "Copa sin puntos cargados";
    const detail = leaderInfo.hasPoints
        ? `${leaderInfo.maxScore} pts en la punta`
        : "Resultados parciales";

    return {
        title: "Copa de las Casas",
        subtitle: `WizarCon • ${getShareDateLabel()}`,
        badge: "Resultados parciales",
        status,
        detail,
        themeHouse,
        rows,
        hasScores: true,
        fileName: `wizarcon-resultados-parciales-${getShareDateLabel().replace(/\//g, "-")}.png`,
        shareText: `${status} en la Copa de las Casas WizarCon.`,
    };
}

function getCupShareCardData(copa) {
    const scoreRows = getCupScoreRows(copa);
    const hasScores = scoreRows.length > 0;
    const rows = hasScores ? scoreRows : [{ casa: copa.ganador, puntos: null }];

    return {
        title: `Copa ${copa.copa}`,
        subtitle: `WizarCon • ${copa.anio}`,
        badge: "Resultados finales",
        status: `Ganó ${copa.ganador}`,
        detail: hasScores ? "Ranking final archivado" : "Ganador histórico",
        themeHouse: copa.ganador,
        rows,
        hasScores,
        fileName: `wizarcon-copa-${copa.copa}-${sanitizeFilePart(copa.anio)}.png`,
        shareText: `${copa.ganador} ganó la Copa ${copa.copa} de WizarCon (${copa.anio}).`,
    };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
}

function drawFittedText(ctx, text, x, y, maxWidth, fontSize, weight = 700) {
    let currentSize = fontSize;

    do {
        ctx.font = `${weight} ${currentSize}px Segoe UI, Arial, sans-serif`;
        if (ctx.measureText(text).width <= maxWidth || currentSize <= 28) {
            break;
        }
        currentSize -= 2;
    } while (currentSize > 28);

    ctx.fillText(text, x, y);
}

function drawShareCardCanvas(cardData) {
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_CARD_SIZE.width;
    canvas.height = SHARE_CARD_SIZE.height;

    const ctx = canvas.getContext("2d");
    const theme = getCardTheme(cardData.themeHouse);
    const maxScore = Math.max(1, ...cardData.rows.map((row) => row.puntos ?? 0));

    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, theme.shadow);
    background.addColorStop(0.42, theme.primary);
    background.addColorStop(1, theme.secondary);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.translate(-180, 90);
    ctx.rotate(-0.28);
    for (let index = 0; index < 6; index += 1) {
        ctx.fillRect(0, index * 205, 1500, 42);
    }
    ctx.restore();

    fillRoundedRect(ctx, 70, 70, 940, 1210, 34, "rgba(11, 11, 13, 0.82)");
    fillRoundedRect(ctx, 102, 102, 876, 1146, 26, "rgba(255, 255, 255, 0.055)");

    ctx.fillStyle = theme.secondary;
    ctx.font = "800 34px Segoe UI, Arial, sans-serif";
    ctx.fillText("WizarCon", 132, 164);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Segoe UI, Arial, sans-serif";
    ctx.fillText(cardData.badge, 948, 164);
    ctx.textAlign = "left";

    ctx.fillStyle = "#ffffff";
    drawFittedText(ctx, cardData.title, 132, 278, 816, 72, 850);
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.font = "500 30px Segoe UI, Arial, sans-serif";
    ctx.fillText(cardData.subtitle, 132, 328);

    fillRoundedRect(ctx, 132, 386, 816, 156, 22, "rgba(255, 255, 255, 0.08)");
    ctx.fillStyle = theme.secondary;
    ctx.font = "800 38px Segoe UI, Arial, sans-serif";
    ctx.fillText(cardData.status, 164, 452);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px Segoe UI Emoji, Segoe UI, Arial, sans-serif";
    ctx.fillText(`${HOUSE_ICONS[cardData.themeHouse] ?? "🏆"} ${cardData.themeHouse}`, 164, 512);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "600 28px Segoe UI, Arial, sans-serif";
    ctx.fillText(cardData.detail, 916, 512);
    ctx.textAlign = "left";

    const rowStartY = 610;
    const rowGap = 138;
    cardData.rows.slice(0, 4).forEach((row, index) => {
        const y = rowStartY + index * rowGap;
        const score = row.puntos ?? 0;
        const barWidth = cardData.hasScores ? Math.max(8, Math.round((score / maxScore) * 520)) : 520;

        fillRoundedRect(ctx, 132, y, 816, 104, 18, "rgba(0, 0, 0, 0.24)");
        ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
        ctx.font = "800 30px Segoe UI, Arial, sans-serif";
        ctx.fillText(`#${index + 1}`, 164, y + 63);

        ctx.fillStyle = "#ffffff";
        ctx.font = "750 34px Segoe UI Emoji, Segoe UI, Arial, sans-serif";
        ctx.fillText(`${HOUSE_ICONS[row.casa]} ${row.casa}`, 236, y + 63);

        ctx.textAlign = "right";
        ctx.fillStyle = theme.secondary;
        ctx.font = "850 38px Segoe UI, Arial, sans-serif";
        ctx.fillText(cardData.hasScores ? `${score} pts` : "Ganador", 916, y + 63);
        ctx.textAlign = "left";

        if (cardData.hasScores) {
            fillRoundedRect(ctx, 236, y + 78, 520, 10, 5, "rgba(255, 255, 255, 0.14)");
            fillRoundedRect(ctx, 236, y + 78, barWidth, 10, 5, theme.secondary);
        }
    });

    fillRoundedRect(ctx, 132, 1186, 816, 44, 22, theme.secondary);
    ctx.fillStyle = theme.textOnSecondary;
    ctx.font = "800 22px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Imagen generada desde la Copa WizarCon", 540, 1216);
    ctx.textAlign = "left";

    return canvas;
}

function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error("No se pudo generar la imagen."));
        }, "image/png");
    });
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function createShareCardBlob(cardData) {
    const canvas = drawShareCardCanvas(cardData);
    return canvasToPngBlob(canvas);
}

async function shareCard(cardData) {
    try {
        const blob = await createShareCardBlob(cardData);

        if (typeof File === "function") {
            const file = new File([blob], cardData.fileName, { type: "image/png" });

            if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: cardData.title,
                    text: cardData.shareText,
                });
                showStatus("Tarjeta lista para compartir.", "info");
                return;
            }
        }

        downloadBlob(blob, cardData.fileName);
        showStatus("Este navegador no permite compartir la imagen; descargué el PNG.", "warning");
    } catch (error) {
        if (error?.name === "AbortError") {
            return;
        }

        console.error("No se pudo compartir la tarjeta.", error);
        showStatus("No se pudo compartir la tarjeta. Probá descargar el PNG.", "error");
    }
}

async function downloadShareCard(cardData) {
    try {
        const blob = await createShareCardBlob(cardData);
        downloadBlob(blob, cardData.fileName);
        showStatus("Tarjeta descargada como PNG.", "info");
    } catch (error) {
        console.error("No se pudo descargar la tarjeta.", error);
        showStatus("No se pudo generar la tarjeta PNG.", "error");
    }
}

function buildCupStatsHtml(copas) {
    const stats = getCupStats(copas);

    if (stats.orderedCups.length === 0) {
        return '<p class="empty-state">No hay copas registradas.</p>';
    }

    const bestStreak = stats.bestStreaks[0];
    const activeStreak = stats.activeStreak;
    const bestStreakHouses = [...new Set(stats.bestStreaks.map((streak) => streak.casa))];
    const housesByWins = [...HOUSE_ORDER].sort((a, b) => {
        const winsDiff = stats.winsByHouse[b] - stats.winsByHouse[a];
        return winsDiff || HOUSE_ORDER.indexOf(a) - HOUSE_ORDER.indexOf(b);
    });

    return `
        <div class="cup-stat-list">
            <div class="cup-stat">
                <span>Casa con más copas ganadas</span>
                <strong>${formatHouseList(stats.topHouses)}</strong>
                <small>${formatCupCount(stats.maxWins)}</small>
            </div>
            <div class="cup-stat">
                <span>Casa con la mejor racha</span>
                <strong>${formatHouseList(bestStreakHouses)}</strong>
                <small>${formatCupCount(stats.bestStreakCount)} seguidas (${escapeHtml(formatCupSpan(bestStreak))})</small>
            </div>
            <div class="cup-stat">
                <span>Racha vigente</span>
                <strong>${formatHouseName(activeStreak.casa)}</strong>
                <small>${formatCupCount(activeStreak.count)} (${escapeHtml(formatCupSpan(activeStreak))})</small>
            </div>
        </div>
        <div class="house-win-list">
            ${housesByWins.map((casa) => `
                <div>
                    <span>${formatHouseName(casa)}</span>
                    <strong>${formatCupCount(stats.winsByHouse[casa])}</strong>
                </div>
            `).join("")}
        </div>
    `;
}

function formatStoredDateTime(value) {
    if (!value) {
        return "";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return parsedDate.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getCupScoreRows(copa) {
    if (!copa?.puntajesFinales) {
        return [];
    }

    return HOUSE_ORDER
        .map((casa) => ({
            casa,
            puntos: Number.parseInt(copa.puntajesFinales[casa], 10) || 0,
        }))
        .sort((a, b) => {
            const scoreDiff = b.puntos - a.puntos;
            return scoreDiff || HOUSE_ORDER.indexOf(a.casa) - HOUSE_ORDER.indexOf(b.casa);
        });
}

function buildCupScoreHtml(scoreRows) {
    if (scoreRows.length === 0) {
        return `
            <p class="cup-detail-note">
                Esta copa viene del historial inicial, sin puntajes finales archivados.
            </p>
        `;
    }

    const margin = scoreRows[0].puntos - scoreRows[1].puntos;
    const marginText = margin === 0
        ? "Diferencia: empate en puntaje final"
        : `Diferencia con ${formatHouseName(scoreRows[1].casa)}: ${margin} pts`;

    return `
        <div class="cup-detail-grid">
            <div class="cup-detail-ranking">
                <h4>Ranking final</h4>
                <table>
                    ${scoreRows.map((row, index) => `
                        <tr>
                            <td>${index + 1}. ${formatHouseName(row.casa)}</td>
                            <td style="text-align:right" class="total-pts">${row.puntos}</td>
                        </tr>
                    `).join("")}
                </table>
            </div>
            <div class="cup-detail-summary">
                <span>Margen de victoria</span>
                <strong>${escapeHtml(marginText)}</strong>
            </div>
        </div>
    `;
}

function buildCupActivitiesHtml(copa) {
    if (!Array.isArray(copa.actividades) || copa.actividades.length === 0) {
        return '<p class="cup-detail-note">No hay actividades archivadas para esta copa.</p>';
    }

    return `
        <div class="cup-activity-list">
            ${copa.actividades.map((actividad) => `<span>${escapeHtml(actividad)}</span>`).join("")}
        </div>
    `;
}

function buildCupMovementsHtml(copa) {
    if (!Array.isArray(copa.historial) || copa.historial.length === 0) {
        return '<p class="cup-detail-note">No hay movimientos archivados para esta copa.</p>';
    }

    return `
        <div class="cup-movement-list">
            ${[...copa.historial].reverse().map((registro) => {
                const sign = registro.puntos > 0 ? "+" : "";
                const toneClass = registro.puntos > 0 ? "is-positive" : "is-negative";
                const fecha = formatHistoryDate(registro);

                return `
                    <div class="cup-movement ${toneClass}">
                        <strong>${formatHouseName(registro.casa)} ${sign}${registro.puntos} pts</strong>
                        <span>${escapeHtml(registro.actividad)} • ${escapeHtml(fecha)} • ${escapeHtml(registro.hora)}</span>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function buildCupDetailHtml(copa) {
    if (!copa) {
        return '<p class="empty-state">Seleccioná una copa para ver su detalle.</p>';
    }

    const scoreRows = getCupScoreRows(copa);
    const closedAt = formatStoredDateTime(copa.fechaFinalizacion);

    return `
        <div class="cup-detail-header">
            <div>
                <span>Copa ${copa.copa} • ${escapeHtml(copa.anio)}</span>
                <strong>${formatHouseName(copa.ganador)}</strong>
            </div>
            ${closedAt ? `<small>Cerrada: ${escapeHtml(closedAt)}</small>` : ""}
        </div>
        <div class="share-actions share-actions-detail">
            <button onclick="compartirTarjetaCopa(${copa.copa})" class="btn-share-card">✨ Compartir tarjeta</button>
            <button onclick="descargarTarjetaCopa(${copa.copa})" class="btn-download-card">⬇ Descargar PNG</button>
        </div>
        ${buildCupScoreHtml(scoreRows)}
        <div class="cup-detail-section">
            <h4>Actividades</h4>
            ${buildCupActivitiesHtml(copa)}
        </div>
        <div class="cup-detail-section">
            <h4>Movimientos guardados</h4>
            ${buildCupMovementsHtml(copa)}
        </div>
    `;
}

function buildCeremonySparkles() {
    const sparkles = [
        [8, 16, 0],
        [18, 42, 2],
        [28, 12, 1],
        [42, 28, 3],
        [56, 10, 1],
        [70, 34, 2],
        [84, 14, 0],
        [92, 46, 3],
        [12, 72, 2],
        [34, 84, 0],
        [62, 78, 3],
        [86, 70, 1],
    ];

    return sparkles
        .map(([left, top, delay]) => `<span style="left:${left}%; top:${top}%; animation-delay:${delay * 0.35}s;"></span>`)
        .join("");
}

function buildCeremonyRankingHtml(copa) {
    const scoreRows = getCupScoreRows(copa);

    if (scoreRows.length === 0) {
        return `
            <p class="ceremony-note">
                Esta copa no tiene ranking final archivado. Las copas cerradas desde ahora van a mostrar el ranking completo.
            </p>
        `;
    }

    return `
        <div class="ceremony-ranking">
            ${scoreRows.map((row, index) => `
                <div class="ceremony-rank-row ${index === 0 ? "is-winner" : ""}">
                    <span class="ceremony-rank-place">#${index + 1}</span>
                    <span class="ceremony-rank-house">${formatHouseName(row.casa)}</span>
                    <strong>${row.puntos} pts</strong>
                </div>
            `).join("")}
        </div>
    `;
}

function buildCeremonyMarginHtml(copa) {
    const scoreRows = getCupScoreRows(copa);

    if (scoreRows.length < 2) {
        return "";
    }

    const margin = scoreRows[0].puntos - scoreRows[1].puntos;
    const marginText = margin === 0
        ? "Victoria con empate en puntaje final"
        : `${margin} pts sobre ${formatHouseName(scoreRows[1].casa)}`;

    return `<p class="ceremony-margin">${escapeHtml(marginText)}</p>`;
}

function buildCeremonyHtml(copa) {
    if (!copa) {
        return `
            <div class="ceremony-empty card">
                <h3>🏆 Ceremonia de Copa</h3>
                <p class="empty-state">Todavía no hay una copa finalizada para celebrar.</p>
                <button onclick="mostrarVistaPrincipal()" class="btn-back-view">← Volver a Copa Actual</button>
            </div>
        `;
    }

    const theme = getCardTheme(copa.ganador);
    const scoreRows = getCupScoreRows(copa);
    const winningScore = scoreRows[0]?.puntos;

    return `
        <div
            class="ceremony-view"
            style="--ceremony-primary:${theme.primary}; --ceremony-secondary:${theme.secondary}; --ceremony-shadow:${theme.shadow}; --ceremony-text-on-secondary:${theme.textOnSecondary};"
        >
            <div class="ceremony-sparkles" aria-hidden="true">${buildCeremonySparkles()}</div>
            <div class="ceremony-shell">
                <p class="ceremony-eyebrow">WizarCon presenta</p>
                <h2>Ganador Copa ${copa.copa}</h2>
                <div class="ceremony-winner">${HOUSE_ICONS[copa.ganador]} ${escapeHtml(copa.ganador)}</div>
                <p class="ceremony-year">${escapeHtml(copa.anio)}${winningScore !== undefined ? ` • ${winningScore} pts` : ""}</p>
                ${buildCeremonyMarginHtml(copa)}
                ${buildCeremonyRankingHtml(copa)}
                <div class="ceremony-actions">
                    <button onclick="compartirTarjetaCopa(${copa.copa})" class="btn-share-card">✨ Compartir tarjeta</button>
                    <button onclick="descargarTarjetaCopa(${copa.copa})" class="btn-download-card">⬇ Descargar PNG</button>
                    <button onclick="verCopaEnHistorial(${copa.copa})" class="btn-secondary-view">🏰 Ver en historial</button>
                    <button onclick="mostrarVistaPrincipal()" class="btn-back-view">← Copa actual</button>
                </div>
            </div>
        </div>
    `;
}

function getCeremonyCup() {
    const copas = getOrderedCups();
    return copas.find((copa) => copa.copa === ceremonyCupNumber) ?? copas.at(-1) ?? null;
}

function renderCeremony() {
    if (!ceremoniaContenidoEl) {
        return;
    }

    ceremoniaContenidoEl.innerHTML = buildCeremonyHtml(getCeremonyCup());
}

function renderCupHistory() {
    if (!tablaCopasEl || !estadisticasCopasEl) {
        return;
    }

    const copas = getOrderedCups();
    if (copas.length > 0 && !copas.some((copa) => copa.copa === selectedCupNumber)) {
        selectedCupNumber = copas.at(-1).copa;
    }

    if (copas.length === 0) {
        tablaCopasEl.innerHTML = '<tr><td class="empty-state">No hay copas registradas.</td></tr>';
    } else {
        tablaCopasEl.innerHTML = `
            <tr><th>Copa</th><th>Año</th><th>Ganador</th><th>Detalle</th></tr>
            ${copas.map((copa) => `
                <tr
                    class="cup-row ${selectedCupNumber === copa.copa ? "is-selected" : ""}"
                    onclick="seleccionarCopa(${copa.copa})"
                    tabindex="0"
                    onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); seleccionarCopa(${copa.copa}); }"
                >
                    <td>${copa.copa}</td>
                    <td>${escapeHtml(copa.anio)}</td>
                    <td>${HOUSE_ICONS[copa.ganador]} ${escapeHtml(copa.ganador)}</td>
                    <td><button class="btn-cup-detail" onclick="event.stopPropagation(); seleccionarCopa(${copa.copa})">Ver</button></td>
                </tr>
            `).join("")}
        `;
    }

    estadisticasCopasEl.innerHTML = buildCupStatsHtml(copas);
    if (detalleCopaEl) {
        const selectedCup = copas.find((copa) => copa.copa === selectedCupNumber) ?? copas.at(-1);
        detalleCopaEl.innerHTML = buildCupDetailHtml(selectedCup);
    }
}

function getViewFromLocation() {
    if (window.location.hash === CEREMONY_HASH) {
        return "ceremonia";
    }

    return window.location.hash === CUP_HISTORY_HASH ? "historial-copas" : "copa";
}

function updateViewUrl(viewName) {
    const nextHash = viewName === "historial-copas"
        ? CUP_HISTORY_HASH
        : viewName === "ceremonia"
            ? CEREMONY_HASH
            : "";

    if (nextHash && window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
        return;
    }

    if (!nextHash && window.location.hash) {
        window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    }
}

function mostrarVista(viewName, updateUrl = true) {
    const showCupHistory = viewName === "historial-copas";
    const showCeremony = viewName === "ceremonia";

    vistaCopaEl?.classList.toggle("is-hidden", showCupHistory || showCeremony);
    vistaHistorialCopasEl?.classList.toggle("is-hidden", !showCupHistory);
    vistaCeremoniaEl?.classList.toggle("is-hidden", !showCeremony);

    if (showCupHistory) {
        renderCupHistory();
    }

    if (showCeremony) {
        renderCeremony();
    }

    if (updateUrl) {
        updateViewUrl(viewName);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function mostrarVistaDesdeUrl() {
    mostrarVista(getViewFromLocation(), false);
}

function hideLoadingOverlay() {
    loadingOverlayEl.style.display = "none";
}

function showStatus(message, tone = "info") {
    statusBannerEl.textContent = message;
    statusBannerEl.className = `status-banner status-banner-${tone}`;
}

function clearStatus() {
    statusBannerEl.textContent = "";
    statusBannerEl.className = "status-banner is-hidden";
}

function getSelectedActivity(fallback = db.actividades[0]) {
    const currentValue = selectActividadEl.value;
    return db.actividades.includes(currentValue) ? currentValue : fallback;
}

function getSelectedHistoryActivity() {
    return filtroHistorialEl.value || ALL_ACTIVITIES_FILTER;
}

function formatHistoryDate(registro) {
    if (registro.fecha) {
        return registro.fecha;
    }

    if (registro.fechaISO) {
        const parsedDate = new Date(registro.fechaISO);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        }
    }

    return "Fecha no registrada";
}

let db = createDefaultState();
let copaRef = null;
let hasPendingLocalChanges = false;
let isSyncingPendingChanges = false;
let isFirebaseConnected = navigator.onLine;
let hasFirebaseConnectionState = false;
let selectedCupNumber = null;
let ceremonyCupNumber = null;

function readLocalState(storageKey) {
    try {
        const rawState = localStorage.getItem(storageKey);
        if (!rawState) {
            return null;
        }

        const parsedState = JSON.parse(rawState);
        const state = parsedState?.state ?? parsedState;
        const hasKnownStateShape = state && typeof state === "object" && [
            "bases",
            "puntosEvento",
            "actividades",
            "historial",
            "copas",
        ].some((key) => Object.prototype.hasOwnProperty.call(state, key));

        return hasKnownStateShape ? normalizeState(state) : null;
    } catch (error) {
        console.error("No se pudo leer la copia local.", error);
        return null;
    }
}

function writeLocalState(storageKey, state) {
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            savedAt: new Date().toISOString(),
            state,
        }));
        return true;
    } catch (error) {
        console.error("No se pudo guardar la copia local.", error);
        showStatus("No se pudo guardar una copia local en este dispositivo.", "error");
        return false;
    }
}

function removeLocalState(storageKey) {
    try {
        localStorage.removeItem(storageKey);
    } catch (error) {
        console.error("No se pudo borrar la copia local.", error);
    }
}

function restoreLocalState() {
    const pendingState = readLocalState(PENDING_STATE_KEY);
    if (pendingState) {
        db = pendingState;
        hasPendingLocalChanges = true;
        return true;
    }

    const lastSyncedState = readLocalState(LAST_SYNCED_STATE_KEY);
    if (lastSyncedState) {
        db = lastSyncedState;
        return true;
    }

    return false;
}

function savePendingLocalChanges() {
    hasPendingLocalChanges = true;
    return writeLocalState(PENDING_STATE_KEY, db);
}

function clearPendingLocalChanges() {
    removeLocalState(PENDING_STATE_KEY);
    hasPendingLocalChanges = false;
}

function saveLastSyncedState() {
    writeLocalState(LAST_SYNCED_STATE_KEY, db);
}

function canSyncWithFirebase() {
    return Boolean(copaRef && isFirebaseConnected);
}

function updateSyncStatus() {
    if (hasPendingLocalChanges) {
        if (isSyncingPendingChanges) {
            showStatus("Sincronizando cambios pendientes con Firebase...", "info");
            return;
        }

        if (canSyncWithFirebase()) {
            showStatus("Cambios guardados en este dispositivo. Esperando confirmacion de Firebase...", "warning");
            return;
        }

        showStatus("Sin conexion: los cambios quedan guardados en este dispositivo y se sincronizan al volver la senal.", "warning");
        return;
    }

    if (!navigator.onLine || (hasFirebaseConnectionState && !isFirebaseConnected)) {
        showStatus("Sin conexion: podes cargar puntos y se guardaran en este dispositivo.", "warning");
        return;
    }

    clearStatus();
}

async function syncPendingLocalChanges() {
    if (!hasPendingLocalChanges || isSyncingPendingChanges || !canSyncWithFirebase()) {
        updateSyncStatus();
        return;
    }

    const pendingState = readLocalState(PENDING_STATE_KEY);
    if (pendingState) {
        db = pendingState;
        renderizarUI();
    }

    isSyncingPendingChanges = true;
    updateSyncStatus();

    try {
        await set(copaRef, db);
        clearPendingLocalChanges();
        saveLastSyncedState();
    } catch (error) {
        console.error("No se pudieron sincronizar los cambios pendientes.", error);
        showStatus("No se pudo sincronizar todavia. Los cambios siguen guardados en este dispositivo.", "error");
    } finally {
        isSyncingPendingChanges = false;
        updateSyncStatus();
    }
}

async function guardarCambios() {
    const savedLocalCopy = savePendingLocalChanges();
    if (!savedLocalCopy && !canSyncWithFirebase()) {
        showStatus("No se pudo guardar una copia local. No cierres la app hasta recuperar conexion.", "error");
        return;
    }

    updateSyncStatus();
    await syncPendingLocalChanges();
}

function renderizarUI(selectedActivity = getSelectedActivity(), selectedHistoryActivity = getSelectedHistoryActivity()) {
    if (db.actividades.length === 0) {
        db.actividades = ["General"];
    }

    selectActividadEl.innerHTML = db.actividades
        .map((actividad) => `<option value="${escapeHtml(actividad)}">${escapeHtml(actividad)}</option>`)
        .join("");
    selectActividadEl.value = db.actividades.includes(selectedActivity) ? selectedActivity : db.actividades[0];

    listaActividadesEl.innerHTML = db.actividades
        .map((actividad, index) => `
            <div class="act-item">
                <span>${escapeHtml(actividad)}</span>
                <button
                    class="btn-del"
                    onclick="borrarActividad(${index})"
                    ${db.actividades.length === 1 ? "disabled title=\"Debe quedar al menos una actividad\"" : ""}
                >
                    ✕
                </button>
            </div>
        `)
        .join("");

    const actividadesHistorial = [...new Set([
        ...db.actividades,
        ...db.historial.map((registro) => registro.actividad),
    ].filter(Boolean))];
    const filtroActivo = selectedHistoryActivity === ALL_ACTIVITIES_FILTER
        || actividadesHistorial.includes(selectedHistoryActivity)
        ? selectedHistoryActivity
        : ALL_ACTIVITIES_FILTER;

    filtroHistorialEl.innerHTML = `
        <option value="${ALL_ACTIVITIES_FILTER}">Todas las actividades</option>
        ${actividadesHistorial
            .map((actividad) => `<option value="${escapeHtml(actividad)}">${escapeHtml(actividad)}</option>`)
            .join("")}
    `;
    filtroHistorialEl.value = filtroActivo;

    const registrosHistorial = db.historial
        .map((registro, index) => ({ registro, index }))
        .filter(({ registro }) => filtroActivo === ALL_ACTIVITIES_FILTER || registro.actividad === filtroActivo);

    if (db.historial.length === 0) {
        historialEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem;">No hay movimientos registrados.</p>';
    } else if (registrosHistorial.length === 0) {
        historialEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem;">No hay movimientos para esta actividad.</p>';
    } else {
        historialEl.innerHTML = registrosHistorial
            .reverse()
            .map(({ registro, index }) => {
                const sign = registro.puntos > 0 ? "+" : "";
                const color = registro.puntos > 0 ? "#4CAF50" : "#ff4444";
                const fecha = formatHistoryDate(registro);

                return `
                    <div class="act-item" style="font-size: 0.85rem; padding: 10px;">
                        <div style="flex-grow: 1;">
                            <strong style="color: #ffd700;">${escapeHtml(registro.casa)}</strong>:
                            <span style="color:${color}; font-weight:bold;">${sign}${registro.puntos} pts</span>
                            <br>
                            <span style="color:#aaa;">${escapeHtml(registro.actividad)} • ${escapeHtml(fecha)} • 🕒 ${escapeHtml(registro.hora)}</span>
                        </div>
                        <button class="btn-undo" onclick="deshacerMovimiento(${index})">↩ Deshacer</button>
                    </div>
                `;
            })
            .join("");
    }

    const puntajesActuales = getScoreSnapshot();
    const leaderInfo = getLeaderInfo(puntajesActuales);
    const casasOrdenadas = [...HOUSE_ORDER].sort((a, b) => puntajesActuales[b] - puntajesActuales[a]);

    if (copaActualResumenEl) {
        copaActualResumenEl.textContent = buildCurrentCupSummary(leaderInfo);
        copaActualResumenEl.className = `winner-banner ${leaderInfo.winner ? `winner-${leaderInfo.winner.toLowerCase()}` : ""}`;
    }
    tablaPosicionesEl.innerHTML = `
        <tr><th>Casa</th><th style="text-align:right">Total</th></tr>
        ${casasOrdenadas.map((casa) => `
            <tr class="${leaderInfo.winner === casa ? "is-leading" : ""}">
                <td>${HOUSE_ICONS[casa]} ${escapeHtml(casa)}</td>
                <td style="text-align:right" class="total-pts">${puntajesActuales[casa]}</td>
            </tr>
        `).join("")}
    `;

    renderCupHistory();
    if (!vistaCeremoniaEl?.classList.contains("is-hidden")) {
        renderCeremony();
    }
    applyHouseTheme();

    HOUSE_ORDER.forEach((casa) => {
        document.getElementById(`base-${casa}`).value = db.bases[casa];
    });
}

window.mostrarHistorialCopas = () => {
    mostrarVista("historial-copas");
};

window.mostrarVistaPrincipal = () => {
    mostrarVista("copa");
};

window.seleccionarCopa = (cupNumber) => {
    const parsedCupNumber = Number.parseInt(cupNumber, 10);
    if (!Number.isInteger(parsedCupNumber)) {
        return;
    }

    selectedCupNumber = parsedCupNumber;
    renderCupHistory();
    detalleCopaEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

window.verCopaEnHistorial = (cupNumber) => {
    const parsedCupNumber = Number.parseInt(cupNumber, 10);
    if (Number.isInteger(parsedCupNumber)) {
        selectedCupNumber = parsedCupNumber;
    }

    mostrarVista("historial-copas");
};

function getCupByNumber(cupNumber) {
    const parsedCupNumber = Number.parseInt(cupNumber, 10);
    return getOrderedCups().find((copa) => copa.copa === parsedCupNumber) ?? null;
}

window.compartirTarjetaActual = async () => {
    await shareCard(getCurrentShareCardData());
};

window.descargarTarjetaActual = async () => {
    await downloadShareCard(getCurrentShareCardData());
};

window.compartirTarjetaCopa = async (cupNumber) => {
    const copa = getCupByNumber(cupNumber);
    if (!copa) {
        showStatus("No se encontró esa copa para compartir.", "warning");
        return;
    }

    await shareCard(getCupShareCardData(copa));
};

window.descargarTarjetaCopa = async (cupNumber) => {
    const copa = getCupByNumber(cupNumber);
    if (!copa) {
        showStatus("No se encontró esa copa para descargar.", "warning");
        return;
    }

    await downloadShareCard(getCupShareCardData(copa));
};

window.registrarPuntos = async (casa) => {
    if (!HOUSE_ORDER.includes(casa)) {
        return;
    }

    const puntos = Number.parseInt(puntosInputEl.value, 10) || 0;
    if (puntos === 0) {
        showStatus("Ingresá un número distinto de 0 para registrar puntos.", "warning");
        return;
    }

    const actividad = getSelectedActivity();
    const ahora = new Date();
    db.puntosEvento[casa] += puntos;
    db.historial.push({
        casa,
        puntos,
        actividad,
        fecha: ahora.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }),
        fechaISO: ahora.toISOString(),
        hora: ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    });

    renderizarUI(actividad);
    await guardarCambios();
};

window.deshacerMovimiento = async (index) => {
    const registro = db.historial[index];
    if (!registro) {
        return;
    }

    if (!confirm("¿Estás seguro de deshacer este movimiento?")) {
        return;
    }

    db.puntosEvento[registro.casa] -= registro.puntos;
    db.historial.splice(index, 1);

    renderizarUI();
    await guardarCambios();
};

window.actualizarBases = async () => {
    HOUSE_ORDER.forEach((casa) => {
        db.bases[casa] = Number.parseInt(document.getElementById(`base-${casa}`).value, 10) || 0;
    });

    renderizarUI();
    await guardarCambios();
};

window.crearActividad = async () => {
    const nombre = nuevaActividadEl.value.trim();

    if (!nombre) {
        showStatus("Escribí un nombre para la actividad.", "warning");
        return;
    }

    if (db.actividades.some((actividad) => actividad.toLowerCase() === nombre.toLowerCase())) {
        showStatus("Esa actividad ya existe.", "warning");
        return;
    }

    db.actividades.push(nombre);
    nuevaActividadEl.value = "";

    renderizarUI(nombre);
    await guardarCambios();
};

window.borrarActividad = async (index) => {
    if (db.actividades.length === 1) {
        showStatus("Debe quedar al menos una actividad activa.", "warning");
        return;
    }

    db.actividades.splice(index, 1);
    const nextActivity = db.actividades[Math.max(0, index - 1)] ?? db.actividades[0];

    renderizarUI(nextActivity);
    await guardarCambios();
};

window.finalizarCopa = async () => {
    const puntajesFinales = getScoreSnapshot();
    const leaderInfo = getLeaderInfo(puntajesFinales);

    if (!leaderInfo.hasPoints) {
        showStatus("Cargá puntos antes de finalizar la copa.", "warning");
        return;
    }

    if (!leaderInfo.winner) {
        showStatus(`Hay empate en la punta: ${formatHouseList(leaderInfo.leaders)}. Definí un ganador antes de cerrar.`, "warning");
        return;
    }

    const anioIngresado = prompt("Año de la copa (por ejemplo 2026 o 2026-2027):", String(new Date().getFullYear()));
    if (anioIngresado === null) {
        return;
    }

    const anio = anioIngresado.trim();
    if (!anio) {
        showStatus("Ingresá un año para finalizar la copa.", "warning");
        return;
    }

    if (!/^\d{4}(?:-\d{4})?$/.test(anio)
        && !confirm("El año no tiene el formato habitual. ¿Guardar igual?")) {
        return;
    }

    if (db.copas.some((copa) => copa.anio.toLowerCase() === anio.toLowerCase())
        && !confirm("Ya existe una copa con ese año. ¿Agregar otra igual?")) {
        return;
    }

    const numeroCopa = getNextCupNumber();
    if (!confirm(`¿Finalizar Copa ${numeroCopa} (${anio}) con ${leaderInfo.winner} como ganador?`)) {
        return;
    }

    const nuevaCopa = {
        copa: numeroCopa,
        anio,
        ganador: leaderInfo.winner,
        puntajesFinales,
        bases: cloneScores(db.bases),
        puntosEvento: cloneScores(db.puntosEvento),
        actividades: [...db.actividades],
        historial: db.historial.map((registro) => ({ ...registro })),
        fechaFinalizacion: new Date().toISOString(),
    };
    const actividadesActuales = db.actividades.length > 0 ? [...db.actividades] : ["General"];

    db.copas = getOrderedCups([...db.copas, nuevaCopa]);
    db.bases = createZeroScores();
    db.puntosEvento = createZeroScores();
    db.historial = [];
    db.actividades = actividadesActuales;
    selectedCupNumber = numeroCopa;
    ceremonyCupNumber = numeroCopa;

    renderizarUI();
    mostrarVista("ceremonia");
    await guardarCambios();

    if (!hasPendingLocalChanges) {
        showStatus(`Copa ${numeroCopa} finalizada: ${leaderInfo.winner} (${anio}).`, "info");
    }
};

window.resetearTodo = async () => {
    if (!confirm("¿Reiniciar la copa actual? Esto borrará puntos, actividades y movimientos sin tocar el historial de copas.")) {
        return;
    }

    const copasArchivadas = db.copas;
    db = createDefaultState();
    db.copas = copasArchivadas;
    renderizarUI();
    await guardarCambios();
};

nuevaActividadEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        window.crearActividad();
    }
});

filtroHistorialEl.addEventListener("change", () => {
    renderizarUI(getSelectedActivity(), getSelectedHistoryActivity());
});

window.addEventListener("popstate", mostrarVistaDesdeUrl);
window.addEventListener("hashchange", mostrarVistaDesdeUrl);
mostrarVistaDesdeUrl();

if (restoreLocalState()) {
    renderizarUI();
    hideLoadingOverlay();
    updateSyncStatus();
}

try {
    const app = initializeApp(firebaseConfig);
    const dbCloud = getDatabase(app);
    copaRef = ref(dbCloud, "wizarcon_copa");
    const connectedRef = ref(dbCloud, ".info/connected");

    onValue(connectedRef, (snapshot) => {
        hasFirebaseConnectionState = true;
        isFirebaseConnected = navigator.onLine && snapshot.val() === true;
        updateSyncStatus();

        if (isFirebaseConnected) {
            void syncPendingLocalChanges();
        }
    });

    onValue(
        copaRef,
        (snapshot) => {
            const data = snapshot.val();

            if (hasPendingLocalChanges) {
                renderizarUI();
                hideLoadingOverlay();
                void syncPendingLocalChanges();
                return;
            }

            db = normalizeState(data);

            if (data === null) {
                void guardarCambios();
            } else {
                saveLastSyncedState();
                updateSyncStatus();
            }

            renderizarUI();
            hideLoadingOverlay();
        },
        (error) => {
            console.error("No se pudo sincronizar la copa.", error);
            showStatus("No se pudo sincronizar con Firebase. Revisá la conexión antes de seguir.", "error");
            renderizarUI();
            hideLoadingOverlay();
        },
    );
} catch (error) {
    console.error("No se pudo inicializar Firebase.", error);
    showStatus("No se pudo iniciar la conexión con Firebase. La interfaz cargó en modo local.", "error");
    renderizarUI();
    hideLoadingOverlay();
}

window.addEventListener("online", () => {
    updateSyncStatus();
    void syncPendingLocalChanges();
});

window.addEventListener("offline", () => {
    hasFirebaseConnectionState = true;
    isFirebaseConnected = false;
    updateSyncStatus();
});

if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", async () => {
        try {
            await navigator.serviceWorker.register("./sw.js");
        } catch (error) {
            console.warn("No se pudo registrar el service worker.", error);
        }
    });
}

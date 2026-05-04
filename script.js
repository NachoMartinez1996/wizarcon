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
const PENDING_STATE_KEY = "wizarcon_copa_pending_state";
const LAST_SYNCED_STATE_KEY = "wizarcon_copa_last_synced_state";

const loadingOverlayEl = document.getElementById("loading-overlay");
const statusBannerEl = document.getElementById("status-banner");
const vistaCopaEl = document.getElementById("vista-copa");
const vistaHistorialCopasEl = document.getElementById("vista-historial-copas");
const selectActividadEl = document.getElementById("select-actividad");
const puntosInputEl = document.getElementById("puntos-input");
const tablaPosicionesEl = document.getElementById("tabla-posiciones");
const copaActualResumenEl = document.getElementById("copa-actual-resumen");
const tablaCopasEl = document.getElementById("tabla-copas");
const estadisticasCopasEl = document.getElementById("estadisticas-copas");
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

function renderCupHistory() {
    if (!tablaCopasEl || !estadisticasCopasEl) {
        return;
    }

    const copas = getOrderedCups();

    if (copas.length === 0) {
        tablaCopasEl.innerHTML = '<tr><td class="empty-state">No hay copas registradas.</td></tr>';
    } else {
        tablaCopasEl.innerHTML = `
            <tr><th>Copa</th><th>Año</th><th>Ganador</th></tr>
            ${copas.map((copa) => `
                <tr>
                    <td>${copa.copa}</td>
                    <td>${escapeHtml(copa.anio)}</td>
                    <td>${HOUSE_ICONS[copa.ganador]} ${escapeHtml(copa.ganador)}</td>
                </tr>
            `).join("")}
        `;
    }

    estadisticasCopasEl.innerHTML = buildCupStatsHtml(copas);
}

function getViewFromLocation() {
    return window.location.hash === CUP_HISTORY_HASH ? "historial-copas" : "copa";
}

function updateViewUrl(showCupHistory) {
    if (showCupHistory && window.location.hash !== CUP_HISTORY_HASH) {
        window.history.pushState(null, "", CUP_HISTORY_HASH);
        return;
    }

    if (!showCupHistory && window.location.hash) {
        window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    }
}

function mostrarVista(viewName, updateUrl = true) {
    const showCupHistory = viewName === "historial-copas";

    vistaCopaEl?.classList.toggle("is-hidden", showCupHistory);
    vistaHistorialCopasEl?.classList.toggle("is-hidden", !showCupHistory);

    if (showCupHistory) {
        renderCupHistory();
    }

    if (updateUrl) {
        updateViewUrl(showCupHistory);
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

    renderizarUI();
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

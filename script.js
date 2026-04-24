import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, onValue, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const HOUSE_ORDER = ["Gryffindor", "Hufflepuff", "Ravenclaw", "Slytherin"];
const HOUSE_ICONS = {
    Gryffindor: "🦁",
    Hufflepuff: "🦡",
    Ravenclaw: "🦅",
    Slytherin: "🐍",
};

const loadingOverlayEl = document.getElementById("loading-overlay");
const statusBannerEl = document.getElementById("status-banner");
const selectActividadEl = document.getElementById("select-actividad");
const puntosInputEl = document.getElementById("puntos-input");
const tablaPosicionesEl = document.getElementById("tabla-posiciones");
const historialEl = document.getElementById("lista-historial");
const listaActividadesEl = document.getElementById("lista-actividades");
const nuevaActividadEl = document.getElementById("nueva-act-nombre");

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

function createDefaultState() {
    return {
        bases: createZeroScores(),
        actividades: ["General"],
        puntosEvento: createZeroScores(),
        historial: [],
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
        hora: String(entry.hora ?? "").trim() || "--:--",
    };
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

    return normalized;
}

function getTotalPoints(casa) {
    return db.bases[casa] + db.puntosEvento[casa];
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

let db = createDefaultState();
let copaRef = null;

async function guardarCambios() {
    if (!copaRef) {
        showStatus("La conexión con Firebase no está disponible en este momento.", "error");
        return;
    }

    try {
        await set(copaRef, db);
        clearStatus();
    } catch (error) {
        console.error("No se pudieron guardar los cambios.", error);
        showStatus("No se pudieron guardar los cambios. Revisá la conexión e intentá de nuevo.", "error");
    }
}

function renderizarUI(selectedActivity = getSelectedActivity()) {
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

    if (db.historial.length === 0) {
        historialEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem;">No hay movimientos registrados.</p>';
    } else {
        historialEl.innerHTML = db.historial
            .slice()
            .reverse()
            .map((registro, reverseIndex) => {
                const realIndex = db.historial.length - 1 - reverseIndex;
                const sign = registro.puntos > 0 ? "+" : "";
                const color = registro.puntos > 0 ? "#4CAF50" : "#ff4444";

                return `
                    <div class="act-item" style="font-size: 0.85rem; padding: 10px;">
                        <div style="flex-grow: 1;">
                            <strong style="color: #ffd700;">${escapeHtml(registro.casa)}</strong>:
                            <span style="color:${color}; font-weight:bold;">${sign}${registro.puntos} pts</span>
                            <br>
                            <span style="color:#aaa;">${escapeHtml(registro.actividad)} • 🕒 ${escapeHtml(registro.hora)}</span>
                        </div>
                        <button class="btn-undo" onclick="deshacerMovimiento(${realIndex})">↩ Deshacer</button>
                    </div>
                `;
            })
            .join("");
    }

    const casasOrdenadas = [...HOUSE_ORDER].sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    tablaPosicionesEl.innerHTML = `
        <tr><th>Casa</th><th style="text-align:right">Total</th></tr>
        ${casasOrdenadas.map((casa) => `
            <tr>
                <td>${HOUSE_ICONS[casa]} ${escapeHtml(casa)}</td>
                <td style="text-align:right" class="total-pts">${getTotalPoints(casa)}</td>
            </tr>
        `).join("")}
    `;

    HOUSE_ORDER.forEach((casa) => {
        document.getElementById(`base-${casa}`).value = db.bases[casa];
    });
}

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
    db.puntosEvento[casa] += puntos;
    db.historial.push({
        casa,
        puntos,
        actividad,
        hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
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

window.resetearTodo = async () => {
    if (!confirm("¿Reiniciar toda la copa? Esto borrará el historial también.")) {
        return;
    }

    db = createDefaultState();
    renderizarUI();
    await guardarCambios();
};

nuevaActividadEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        window.crearActividad();
    }
});

try {
    const app = initializeApp(firebaseConfig);
    const dbCloud = getDatabase(app);
    copaRef = ref(dbCloud, "wizarcon_copa");

    onValue(
        copaRef,
        (snapshot) => {
            const data = snapshot.val();
            db = normalizeState(data);

            if (data === null) {
                void guardarCambios();
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

if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", async () => {
        try {
            await navigator.serviceWorker.register("./sw.js");
        } catch (error) {
            console.warn("No se pudo registrar el service worker.", error);
        }
    });
}

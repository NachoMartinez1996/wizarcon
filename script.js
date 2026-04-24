import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAiG3c-wxi7ugArZc0ScZRzWe6cI2pSl4U",
    authDomain: "copa-wizarcon.firebaseapp.com",
    databaseURL: "https://copa-wizarcon-default-rtdb.firebaseio.com/",
    projectId: "copa-wizarcon",
    storageBucket: "copa-wizarcon.firebasestorage.app",
    messagingSenderId: "177951654125",
    appId: "1:177951654125:web:51ee03a5ad4ef059484ce4",
    measurementId: "G-TSJCCLHWRY"
};

const app = initializeApp(firebaseConfig);
const dbCloud = getDatabase(app);
const copaRef = ref(dbCloud, 'wizarcon_copa');

// Estado local de la App (ahora incluye historial)
let db = {
    bases: { Gryffindor: 0, Hufflepuff: 0, Ravenclaw: 0, Slytherin: 0 },
    actividades: ["General"],
    puntosEvento: { Gryffindor: 0, Hufflepuff: 0, Ravenclaw: 0, Slytherin: 0 },
    historial: []
};

// Escuchar cambios en tiempo real
onValue(copaRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        db = data;
        if (!db.historial) db.historial = []; // Prevención de errores si el historial viene vacío
        renderizarUI();
    } else {
        set(copaRef, db);
    }
    document.getElementById('loading-overlay').style.display = 'none';
});

// Funciones Globales
window.registrarPuntos = (casa) => {
    const pts = parseInt(document.getElementById('puntos-input').value) || 0;
    const actividad = document.getElementById('select-actividad').value;

    if (pts === 0) return; // No guardamos registros de 0 puntos

    // Sumamos los puntos
    db.puntosEvento[casa] += pts;

    // Creamos el registro para la auditoría
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    db.historial.push({
        casa: casa,
        puntos: pts,
        actividad: actividad,
        hora: hora
    });

    set(copaRef, db);
};

window.deshacerMovimiento = (index) => {
    const confirmacion = confirm("¿Estás seguro de deshacer este movimiento?");
    if (confirmacion) {
        // Restamos los puntos de ese movimiento específico
        const registro = db.historial[index];
        db.puntosEvento[registro.casa] -= registro.puntos;

        // Borramos el registro del historial
        db.historial.splice(index, 1);

        set(copaRef, db);
    }
};

window.actualizarBases = () => {
    for (let casa in db.bases) {
        db.bases[casa] = parseInt(document.getElementById(`base-${casa}`).value) || 0;
    }
    set(copaRef, db);
};

window.crearActividad = () => {
    const nombre = document.getElementById('nueva-act-nombre').value.trim();
    if (nombre && !db.actividades.includes(nombre)) {
        db.actividades.push(nombre);
        document.getElementById('nueva-act-nombre').value = "";
        set(copaRef, db);
    }
};

window.borrarActividad = (index) => {
    db.actividades.splice(index, 1);
    set(copaRef, db);
};

window.resetearTodo = () => {
    if (confirm("¿Reiniciar toda la copa? Esto borrará el historial también.")) {
        const reset = {
            bases: { Gryffindor: 0, Hufflepuff: 0, Ravenclaw: 0, Slytherin: 0 },
            actividades: ["General"],
            puntosEvento: { Gryffindor: 0, Hufflepuff: 0, Ravenclaw: 0, Slytherin: 0 },
            historial: []
        };
        set(copaRef, reset);
    }
};

function renderizarUI() {
    // Actualizar Select
    document.getElementById('select-actividad').innerHTML = db.actividades.map(a => `<option value="${a}">${a}</option>`).join('');

    // Actualizar Lista Actividades
    document.getElementById('lista-actividades').innerHTML = db.actividades.map((a, i) => `
                <div class="act-item"><span>${a}</span><button class="btn-del" onclick="borrarActividad(${i})">✕</button></div>
            `).join('');

    // Actualizar Historial de Auditoría (mostramos los últimos arriba)
    const contenedorHistorial = document.getElementById('lista-historial');
    if (db.historial.length === 0) {
        contenedorHistorial.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem;">No hay movimientos registrados.</p>';
    } else {
        // Invertimos el array para que el más nuevo salga primero
        contenedorHistorial.innerHTML = db.historial.slice().reverse().map((h, indexInvertido) => {
            const indexReal = db.historial.length - 1 - indexInvertido; // Recuperamos la posición real para el botón de deshacer
            const signo = h.puntos > 0 ? '+' : '';
            const color = h.puntos > 0 ? '#4CAF50' : '#ff4444';
            return `
                    <div class="act-item" style="font-size: 0.85rem; padding: 10px;">
                        <div style="flex-grow: 1;">
                            <strong style="color: #ffd700;">${h.casa}</strong>: <span style="color:${color}; font-weight:bold;">${signo}${h.puntos} pts</span>
                            <br>
                            <span style="color:#aaa;">${h.actividad} • 🕒 ${h.hora}</span>
                        </div>
                        <button class="btn-undo" onclick="deshacerMovimiento(${indexReal})">↩ Deshacer</button>
                    </div>
                    `;
        }).join('');
    }

    // Actualizar Tabla y Inputs
    const casas = Object.keys(db.bases).sort((a, b) => (db.bases[b] + db.puntosEvento[b]) - (db.bases[a] + db.puntosEvento[a]));
    document.getElementById('tabla-posiciones').innerHTML = `
                <tr><th>Casa</th><th style="text-align:right">Total</th></tr>
                ${casas.map(c => `<tr>
                    <td>${c === 'Gryffindor' ? '🦁' : c === 'Hufflepuff' ? '🦡' : c === 'Ravenclaw' ? '🦅' : '🐍'} ${c}</td>
                    <td style="text-align:right" class="total-pts">${db.bases[c] + db.puntosEvento[c]}</td>
                </tr>`).join('')}
            `;

    for (let casa in db.bases) {
        document.getElementById(`base-${casa}`).value = db.bases[casa];
    }
}
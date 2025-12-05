// public/maestro/mi_horario.js

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORA_INICIO = 7;
const HORA_FIN = 15;

let MAESTRO_LOGUEADO = null;

document.addEventListener('DOMContentLoaded', async () => {
    construirTablaVacia();

    // 🔹 Igual que en mis_materias.js, pero obligando a que sea MAESTRO
    MAESTRO_LOGUEADO = obtenerMaestroLogueado();

    if (!MAESTRO_LOGUEADO) {
        mostrarAlerta(
            'No se encontró la información del maestro logueado. Vuelve a iniciar sesión como maestro.',
            'danger'
        );
        return;
    }

    try {
        await cargarMiHorario();
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error al cargar tu horario.', 'danger');
    }
});

/* ==================== Leer maestro desde localStorage ==================== */

function obtenerMaestroLogueado() {
    try {
        const raw = localStorage.getItem('usuario');
        if (!raw) return null;

        const obj = JSON.parse(raw);

        if (obj.rol && obj.rol.toUpperCase() === 'MAESTRO') {
            return obj;
        }

        return null;
    } catch (e) {
        console.error('Error leyendo usuario de localStorage:', e);
        return null;
    }
}

/* ==================== Tabla vacía ==================== */

function construirTablaVacia() {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    tbody.innerHTML = '';

    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
        const tr = document.createElement('tr');

        const thHora = document.createElement('th');
        thHora.scope = 'row';
        thHora.textContent = `${pad2(h)}:00 - ${pad2(h + 1)}:00`;
        tr.appendChild(thHora);

        for (let i = 0; i < DIAS.length; i++) {
            const td = document.createElement('td');
            td.classList.add('celda-libre');
            td.textContent = 'Libre';
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }
}

function pad2(n) {
    return n.toString().padStart(2, '0');
}

function obtenerHoraDesdeCampo(horaStr) {
    if (!horaStr) return null;
    const partes = horaStr.split(':');
    const h = parseInt(partes[0], 10);
    return isNaN(h) ? null : h;
}

/* ==================== Cargar horario del maestro logueado ==================== */

async function cargarMiHorario() {
    if (!MAESTRO_LOGUEADO) {
        throw new Error('No hay maestro logueado.');
    }

    const maestroId = MAESTRO_LOGUEADO.id;

    // 🔹 Reutilizamos EXACTAMENTE las mismas rutas que usa el jefe:
    //     /api/horarios/maestro-info/:id
    //     /api/horarios/maestro/:id
    const [infoRes, horarioRes] = await Promise.all([
        fetch(`/api/horarios/maestro-info/${maestroId}`),
        fetch(`/api/horarios/maestro/${maestroId}`)
    ]);

    const info = await infoRes.json();
    const data = await horarioRes.json();

    if (!infoRes.ok) {
        throw new Error(info.mensaje || 'Error al obtener datos del maestro.');
    }
    if (!horarioRes.ok) {
        throw new Error(data.mensaje || 'Error al cargar horario del maestro.');
    }

    pintarResumenMaestro(info);
    pintarHorario(data);
}

function pintarResumenMaestro(info) {
    const cont = document.getElementById('resumenMaestro');
    if (!cont) return;

    const horasContrato = Number(info.horas_max_semana || info.horas_contrato || 0);
    const horasAsignadas = Number(info.horas_asignadas || 0);
    const horasLibres = Math.max(horasContrato - horasAsignadas, 0);

    cont.innerHTML = `
        <div class="card mb-3">
            <div class="card-body text-center">
                <h5 class="card-title mb-3 fw-bold">${info.nombre || 'Maestro'}</h5>

                <span class="badge bg-primary me-2">Contrato: ${horasContrato} h</span>
                <span class="badge bg-success me-2">Asignadas: ${horasAsignadas} h</span>
                <span class="badge bg-warning text-dark">Disponibles: ${horasLibres} h</span>
            </div>
        </div>
    `;
}


function pintarHorario(bloques) {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const mapa = {};
    bloques.forEach(b => {
        const hora = obtenerHoraDesdeCampo(b.hora_inicio);
        if (hora == null) return;
        const diaNombre = b.dia === 'Miercoles' ? 'Miércoles' : b.dia;
        const key = `${diaNombre}-${hora}`;
        mapa[key] = b;
    });

    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
        const filaIndex = h - HORA_INICIO;
        const fila = tbody.rows[filaIndex];
        if (!fila) continue;

        DIAS.forEach((dia, i) => {
            const key = `${dia}-${h}`;
            const celda = fila.cells[i + 1];
            const b = mapa[key];

            if (!b) {
                celda.className = 'celda-libre';
                celda.textContent = 'Libre';
            } else {
                celda.className = 'celda-clase';
                celda.innerHTML = `
    <div style="text-align:center; font-size:0.85rem; font-weight:600;">
        ${b.materia_nombre || b.materia || 'Materia'}
    </div>
    <div style="text-align:center; font-size:0.75rem; opacity:.85;">
        Salón ${b.salon_clave || b.salon || '-'}
    </div>
`;

            }
        });
    }

    if (!bloques.length) {
        mostrarAlerta('Aún no tienes clases asignadas en el horario.', 'info');
    }
}

/* ================== TOAST ================== */

function mostrarAlerta(msg, tipo = 'info') {
    let cont = document.getElementById('toast-container');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toast-container';
        document.body.appendChild(cont);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${tipo}`;
    toast.innerHTML = msg;

    toast.addEventListener('click', () => {
        toast.classList.add('app-toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    });

    cont.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('app-toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

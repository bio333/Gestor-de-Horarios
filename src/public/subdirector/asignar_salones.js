// ================== CONSTANTES Y ESTADO ==================
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORA_INICIO = 7;
const HORA_FIN = 15;

let gruposCache = [];     // grupos completos
let mapaBloques = {};     // clave: "diaBD-hora" -> bloque
let salonesCache = [];    // todos los salones
let grupoActual = null;   // objeto grupo seleccionado
let bloqueActual = null;  // bloque de clase sobre el que se abrE el panel

document.addEventListener('DOMContentLoaded', () => {
    cargarGrupos();
    construirTablaVacia();

    const tbody = document.getElementById('tbodyHorario');
    if (tbody) {
        tbody.addEventListener('click', onClickCelda);
    }

    const selSem = document.getElementById('selectSemestre');
    if (selSem) {
        selSem.addEventListener('change', refrescarSelectGruposPorSemestre);
    }
});

// ================== UTILIDADES UI ==================

function mostrarAlerta(msg, tipo = 'info') {
    const cont = document.getElementById('alert-container');
    if (!cont) return;
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${msg}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function mostrarCompletitud(msg, tipo = 'info') {
    const cont = document.getElementById('alert-completitud');
    if (!cont) return;
    cont.innerHTML = `
        <div class="alert alert-${tipo} mb-0" role="alert">
            ${msg}
        </div>
    `;
}

function pad2(n) {
    return n.toString().padStart(2, '0');
}

// ================== CARGAR GRUPOS ==================

async function cargarGrupos() {
    try {
        const res = await fetch('/api/grupos');
        gruposCache = await res.json();
        refrescarSelectGruposPorSemestre();
    } catch (err) {
        console.error('Error al cargar grupos:', err);
        mostrarAlerta('Error al cargar grupos.', 'danger');
    }
}

function refrescarSelectGruposPorSemestre() {
    const sel = document.getElementById('selectGrupo');
    const selSem = document.getElementById('selectSemestre');
    if (!sel || !selSem) return;

    const semFiltro = selSem.value ? parseInt(selSem.value, 10) : null;

    sel.innerHTML = '<option value="">Selecciona un grupo...</option>';

    gruposCache
        .filter(g => !semFiltro || g.semestre === semFiltro)
        .forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = `Sem ${g.semestre} - Grupo ${g.grupo}`;
            opt.dataset.semestre = g.semestre;
            opt.dataset.grupoTexto = opt.textContent;
            opt.dataset.numEstudiantes = g.num_estudiantes || 0;
            sel.appendChild(opt);
        });
}

// ================== TABLA VACÍA ==================

function construirTablaVacia() {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    tbody.innerHTML = '';
    mapaBloques = {};

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

// ================== CARGAR HORARIO DE UN GRUPO ==================

async function cargarHorarioSeleccionado() {
    const sel = document.getElementById('selectGrupo');
    if (!sel) {
        mostrarAlerta('No se encontró el selector de grupo.', 'danger');
        return;
    }

    const grupoId = sel.value;
    if (!grupoId) {
        mostrarAlerta('Selecciona un grupo primero.', 'warning');
        return;
    }

    construirTablaVacia();
    cerrarPanelSalon();
    mostrarCompletitud('', 'info');

    grupoActual = gruposCache.find(g => String(g.id) === String(grupoId)) || null;

    try {
        const res = await fetch(`/api/horarios?grupo_id=${grupoId}`);
        const rawText = await res.text();

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('Respuesta NO es JSON. Texto crudo:', rawText);
            mostrarAlerta(
                'Error al cargar horario. Respuesta del servidor:<br>' +
                rawText.substring(0, 300),
                'danger'
            );
            return;
        }

        if (!res.ok) {
            mostrarAlerta(
                data.mensaje || data.error || 'Error al cargar horario (API).',
                'danger'
            );
            return;
        }

        mapaBloques = {};
        data.forEach(b => {
            const hora = obtenerHoraDesdeCampo(b.hora_inicio);
            if (hora == null) return;
            const diaKey = b.dia; // 'Lunes' / 'Martes' / 'Miercoles'...
            const key = `${diaKey}-${hora}`;
            mapaBloques[key] = b;
            pintarBloque(b);
        });

        pintarRecesosVirtuales(grupoId);
        await evaluarCompletitudMaterias(grupoId);

    } catch (err) {
        console.error('Error al cargar horario:', err);
        mostrarAlerta('Error al cargar horario (fallo de red o servidor caído).', 'danger');
    }
}

function obtenerHoraDesdeCampo(horaStr) {
    if (!horaStr) return null;
    const partes = horaStr.split(':');
    const h = parseInt(partes[0], 10);
    return isNaN(h) ? null : h;
}

function pintarBloque(bloque) {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const hInicio = obtenerHoraDesdeCampo(bloque.hora_inicio);
    if (hInicio == null) return;

    const filaIndex = hInicio - HORA_INICIO;
    if (filaIndex < 0 || filaIndex >= (HORA_FIN - HORA_INICIO)) return;

    const fila = tbody.rows[filaIndex];

    const diaNombre = bloque.dia === 'Miercoles' ? 'Miércoles' : bloque.dia;
    const diaIndex = DIAS.indexOf(diaNombre);
    if (diaIndex === -1) return;

    const celda = fila.cells[diaIndex + 1];
    celda.className = '';

    if (bloque.tipo === 'RECESO') {
        celda.classList.add('celda-receso');
        celda.textContent = 'RECESO';
    } else if (bloque.tipo === 'CLASE') {
        celda.classList.add('celda-clase');
        celda.innerHTML = `
            <div class="fw-bold" style="font-size:0.85rem;">
                ${bloque.materia_nombre || 'Materia'}
            </div>
            <small>${bloque.maestro_nombre || 'Maestro'}</small>
            <small style="display:block;font-size:0.7rem;opacity:.8;">
                Salón ${bloque.salon_clave || '-'}
            </small>
        `;
    } else {
        celda.classList.add('celda-libre');
        celda.textContent = 'Libre';
    }
}

function pintarRecesosVirtuales(grupoId) {
    const opt = document.querySelector(`#selectGrupo option[value="${grupoId}"]`);
    if (!opt) return;

    const semestre = parseInt(opt.dataset.semestre, 10);
    let recesoHour = null;
    if (semestre >= 1 && semestre <= 3) recesoHour = 11;
    else if (semestre >= 4 && semestre <= 6) recesoHour = 12;
    else if (semestre >= 7 && semestre <= 9) recesoHour = 13;

    if (!recesoHour) return;

    const tbody = document.getElementById('tbodyHorario');
    const filaIndex = recesoHour - HORA_INICIO;
    if (filaIndex < 0 || filaIndex >= (HORA_FIN - HORA_INICIO)) return;

    const fila = tbody.rows[filaIndex];

    DIAS.forEach((dia, i) => {
        const key1 = `${dia}-${recesoHour}`;
        const key2 = `${dia === 'Miércoles' ? 'Miercoles' : dia}-${recesoHour}`;

        if (!mapaBloques[key1] && !mapaBloques[key2]) {
            const celda = fila.cells[i + 1];
            celda.className = 'celda-receso';
            celda.textContent = 'RECESO';
        }
    });
}

// ================== COMPLETITUD DE MATERIAS ==================

async function evaluarCompletitudMaterias(grupoId) {
    const opt = document.querySelector(`#selectGrupo option[value="${grupoId}"]`);
    if (!opt) return;
    const semestre = parseInt(opt.dataset.semestre, 10);

    try {
        const [resMat, resUsos] = await Promise.all([
            fetch(`/api/materias/semestre/${semestre}`),
            fetch(`/api/horarios/materias/usadas-por-grupo/${grupoId}`)
        ]);

        const materias = await resMat.json();
        const usadasPorMateria = await resUsos.json(); // { materia_id: usadas }

        let faltantes = [];

        materias.forEach(m => {
            const creditos = m.creditos || 0;
            const usadas = usadasPorMateria[m.id] || 0;
            if (usadas < creditos) {
                faltantes.push(`${m.nombre}: ${usadas}/${creditos} h`);
            }
        });

        if (faltantes.length === 0) {
            mostrarCompletitud(
                'Todas las materias del semestre para este grupo tienen completas sus horas. ' +
                'Ya puedes asignar salones a cada materia.',
                'success'
            );
        } else {
            mostrarCompletitud(
                'Advertencia: aún hay materias con horas pendientes para este grupo:<br>' +
                faltantes.join('<br>'),
                'warning'
            );
        }

    } catch (err) {
        console.error('Error evaluando completitud de materias:', err);
        mostrarCompletitud('No se pudo verificar las horas de las materias.', 'danger');
    }
}

// ================== CLICK EN CELDAS ==================

function onClickCelda(ev) {
    const td = ev.target.closest('td');
    if (!td) return;

    const fila = td.parentElement;
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const filaIndex = Array.from(tbody.rows).indexOf(fila);
    const horaInicio = HORA_INICIO + filaIndex;

    const colIndex = td.cellIndex;
    if (colIndex === 0) return;

    if (td.classList.contains('celda-receso') ||
        td.classList.contains('celda-libre')) {
        mostrarAlerta('Selecciona una celda que tenga una clase para poder asignar salón.', 'info');
        return;
    }

    const dia = DIAS[colIndex - 1];
    abrirPanelSalon(dia, horaInicio);
}

// ================== PANEL DE ASIGNACIÓN DE SALÓN ==================

async function abrirPanelSalon(diaNombre, horaInicio) {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) return;

    const grupoId = selGrupo.value;
    if (!grupoId) {
        mostrarAlerta('Selecciona un grupo primero.', 'warning');
        return;
    }

    const diaBD = (diaNombre === 'Miércoles') ? 'Miercoles' : diaNombre;
    const key = `${diaBD}-${horaInicio}`;
    const bloque = mapaBloques[key];

    if (!bloque || bloque.tipo !== 'CLASE') {
        mostrarAlerta('En este bloque no hay una clase para asignar salón.', 'info');
        return;
    }

    bloqueActual = bloque;

    const opt = selGrupo.options[selGrupo.selectedIndex];
    const grupoTexto = opt.dataset.grupoTexto || '';
    const grupoNumEst = parseInt(opt.dataset.numEstudiantes || '0', 10);

    document.getElementById('panelGrupoId').value = grupoId;
    document.getElementById('panelMateriaId').value = bloque.materia_id;
    document.getElementById('panelGrupoTexto').textContent = grupoTexto;
    document.getElementById('panelMateriaTexto').textContent = bloque.materia_nombre || '';
    document.getElementById('panelMaestroTexto').textContent = bloque.maestro_nombre || '';
    document.getElementById('panelSalonActualTexto').textContent = bloque.salon_clave || '-';

    await cargarSalonesParaGrupo(grupoNumEst, bloque.salon_id);

    const card = document.getElementById('cardAsignarSalon');
    if (card) {
        card.classList.remove('d-none');
    }
}

function cerrarPanelSalon() {
    const card = document.getElementById('cardAsignarSalon');
    if (card) {
        card.classList.add('d-none');
    }
    bloqueActual = null;
}

// Salones filtrados por capacidad (>= numEstudiantes)
async function cargarSalonesParaGrupo(numEstudiantes, salonActualId) {
    try {
        if (!salonesCache.length) {
            const res = await fetch('/api/salones');
            salonesCache = await res.json();
        }

        const select = document.getElementById('selectSalon');
        if (!select) return;

        select.innerHTML = '<option value="">Selecciona un salón...</option>';

        salonesCache
            .filter(s => (s.capacidad || 0) >= (numEstudiantes || 0))
            .forEach(s => {
                const op = document.createElement('option');
                op.value = s.id;
                op.textContent = `${s.clave} (${s.capacidad} alumnos)`;
                if (salonActualId && Number(salonActualId) === Number(s.id)) {
                    op.selected = true;
                }
                select.appendChild(op);
            });

    } catch (err) {
        console.error('Error al cargar salones:', err);
        mostrarAlerta('Error al cargar salones.', 'danger');
    }
}

// ================== ASIGNAR SALÓN A TODA LA MATERIA ==================

async function asignarSalonMateria() {
    if (!bloqueActual || bloqueActual.tipo !== 'CLASE') {
        mostrarAlerta('Primero selecciona una clase del horario.', 'warning');
        return;
    }

    const grupoId = document.getElementById('panelGrupoId').value;
    const materiaId = document.getElementById('panelMateriaId').value;
    const salonId = document.getElementById('selectSalon').value;

    if (!grupoId || !materiaId || !salonId) {
        mostrarAlerta('Debes seleccionar un salón para continuar.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/horarios/asignar-salon-materia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grupo_id: Number(grupoId),
                materia_id: Number(materiaId),
                salon_id: Number(salonId)
            })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al asignar salón.', 'danger');
            return;
        }

        mostrarAlerta(
            data.mensaje || 'Salón asignado a todas las horas de la materia en este grupo.',
            'success'
        );

        // Recargar horario para ver cambios
        cerrarPanelSalon();
        await cargarHorarioSeleccionado();

    } catch (err) {
        console.error('Error al asignar salón:', err);
        mostrarAlerta('Error al asignar salón.', 'danger');
    }
}

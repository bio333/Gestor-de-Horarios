const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORA_INICIO = 7;
const HORA_FIN = 15;
const DIAS_BD = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

let materiasCache = {};
let mapaBloques = {};   // clave: dia-horaInicio -> bloque
let gruposCache = [];   // para saber semestre y texto del grupo

let panelEditar = null;         // card lateral
let modalHorarioMaestro = null; // bootstrap modal
let bloqueActual = null;        // bloque que se está editando

document.addEventListener('DOMContentLoaded', () => {
    cargarGruposEnSelect();
    construirTablaVacia();

    panelEditar = document.getElementById('panelEditarBloque');

    const modalMaestroEl = document.getElementById('modalHorarioMaestro');
    if (modalMaestroEl) {
        modalHorarioMaestro = new bootstrap.Modal(modalMaestroEl);
    }

    const btnEliminarGrupoCompleto = document.getElementById('btnEliminarGrupoCompleto');
    if (btnEliminarGrupoCompleto) {
        btnEliminarGrupoCompleto.style.display = 'none';
        btnEliminarGrupoCompleto.addEventListener('click', eliminarHorarioGrupoCompleto);
    }

    const tbody = document.getElementById('tbodyHorario');
    if (tbody) {
        tbody.addEventListener('click', onClickCelda);
    }

    const selMateria = document.getElementById('modalSelectMateria');
    if (selMateria) {
        selMateria.addEventListener('change', cargarMaestrosParaMateria);
    }

    const btnEliminar = document.getElementById('btnEliminarClase');
    if (btnEliminar) {
        btnEliminar.addEventListener('click', eliminarClaseActual);
    }

    const btnVerHorarioMaestro = document.getElementById('btnVerHorarioMaestro');
    if (btnVerHorarioMaestro) {
        btnVerHorarioMaestro.addEventListener('click', verHorarioMaestro);
    }

    const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');
    if (btnCancelarEdicion) {
        btnCancelarEdicion.addEventListener('click', ocultarPanelEditar);
    }
});

/* ================== UTILIDADES UI ================== */

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

function mostrarPanelEditar() {
    if (panelEditar) {
        panelEditar.classList.remove('d-none');
    }
}

function ocultarPanelEditar() {
    if (panelEditar) {
        panelEditar.classList.add('d-none');
    }
    bloqueActual = null;
    // opcional: limpiar selects
    const selMat = document.getElementById('modalSelectMateria');
    const selMae = document.getElementById('modalSelectMaestro');
    if (selMat) selMat.value = '';
    if (selMae) selMae.value = '';
}

/* ================== CARGAR GRUPOS ================== */

async function cargarGruposEnSelect() {
    try {
        const res = await fetch('/api/grupos');
        const grupos = await res.json();
        gruposCache = grupos;

        const sel = document.getElementById('selectGrupo');
        if (!sel) return;

        sel.innerHTML = '<option value="">Selecciona un grupo...</option>';

        grupos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = `Sem ${g.semestre} - Grupo ${g.grupo}`;
            opt.dataset.semestre = g.semestre;
            opt.dataset.grupoTexto = opt.textContent;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Error al cargar grupos:', err);
        mostrarAlerta('Error al cargar grupos.', 'danger');
    }
}

/* ================== TABLA VACÍA ================== */

function construirTablaVacia() {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    tbody.innerHTML = '';
    mapaBloques = {};

    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
        const tr = document.createElement('tr');

        const horaTexto = `${pad2(h)}:00 - ${pad2(h + 1)}:00`;
        const thHora = document.createElement('th');
        thHora.scope = 'row';
        thHora.textContent = horaTexto;
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

/* ================== CARGAR HORARIO DE UN GRUPO ================== */

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
    ocultarPanelEditar();

    try {
        const res = await fetch(`/api/horarios?grupo_id=${grupoId}`);
        const rawText = await res.text();

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseErr) {
            console.error('Respuesta NO es JSON. Texto crudo:', rawText);
            mostrarAlerta(
                'Error al cargar horario. Respuesta del servidor:\n' +
                rawText.substring(0, 300),
                'danger'
            );
            return;
        }

        if (!res.ok) {
            console.error('Respuesta /api/horarios no OK:', data);
            mostrarAlerta(
                data.mensaje || data.error || 'Error al cargar horario (API).',
                'danger'
            );
            return;
        }

        const bloques = data;
        mapaBloques = {};

        bloques.forEach(b => {
            const hora = obtenerHoraDesdeCampo(b.hora_inicio);
            if (hora == null) return;
            const diaKey = b.dia;
            const key = `${diaKey}-${hora}`;
            mapaBloques[key] = b;
            pintarBloque(b);
        });

        pintarRecesosVirtuales(grupoId);

    } catch (err) {
        console.error('Error al cargar horario (fetch falló):', err);
        mostrarAlerta('Error al cargar horario (fallo de red o servidor caído).', 'danger');
    }
}

/* ================== PINTAR BLOQUES ================== */

function obtenerHoraDesdeCampo(horaStr) {
    if (!horaStr) return null;
    const partes = horaStr.split(':');
    const h = parseInt(partes[0], 10);
    if (isNaN(h)) return null;
    return h;
}

function pintarBloque(bloque) {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const inicioHora = obtenerHoraDesdeCampo(bloque.hora_inicio);
    if (inicioHora == null) return;

    const filaIndex = inicioHora - HORA_INICIO;
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

function grupoTieneAlMenosUnaClase(grupoId) {
    if (!grupoId) return false;

    for (const key in mapaBloques) {
        const arr = mapaBloques[key];
        if (!Array.isArray(arr)) continue;

        if (arr.some(b => String(b.grupo_id) === String(grupoId))) {
            return true;
        }
    }
    return false;
}

function actualizarBotonEliminarGrupo() {
    const selGrupo = document.getElementById('selectGrupo');
    const btn = document.getElementById('btnEliminarGrupoCompleto');
    if (!selGrupo || !btn) return;

    const grupoId = selGrupo.value;
    if (grupoTieneAlMenosUnaClase(grupoId)) {
        btn.style.display = 'inline-block';
    } else {
        btn.style.display = 'none';
    }
}


/* ================== CLICK EN CELDAS ================== */

function onClickCelda(ev) {
    const td = ev.target.closest('td');
    if (!td) return;

    const fila = td.parentElement;
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const filaIndex = Array.from(tbody.rows).indexOf(fila);
    const horaInicio = HORA_INICIO + filaIndex;

    const colIndex = td.cellIndex; // 0 es la columna "Hora"
    if (colIndex === 0) return;

    const dia = DIAS[colIndex - 1];

    if (td.classList.contains('celda-receso')) {
        mostrarAlerta('Este bloque es de RECESO y no se puede editar.', 'warning');
        return;
    }

    abrirEditorBloque(dia, horaInicio);
}

/* ================== PANEL DE EDICIÓN (antes modal) ================== */

async function abrirEditorBloque(diaNombre, horaInicio) {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) {
        mostrarAlerta('No se encontró el selector de grupo.', 'danger');
        return;
    }

    const grupoId = selGrupo.value;
    if (!grupoId) {
        mostrarAlerta('Selecciona un grupo primero.', 'warning');
        return;
    }

    const diaKey = diaNombre === 'Miércoles' ? 'Miercoles' : diaNombre;
    const key = `${diaKey}-${horaInicio}`;
    bloqueActual = mapaBloques[key] || null;

    document.getElementById('modalGrupoId').value = grupoId;
    document.getElementById('modalDia').value = diaKey;
    document.getElementById('modalHoraInicio').value = horaInicio;

    const opt = selGrupo.options[selGrupo.selectedIndex];
    document.getElementById('modalGrupoTexto').textContent = opt.dataset.grupoTexto;
    document.getElementById('modalDiaTexto').textContent = diaNombre;
    document.getElementById('modalHoraTexto').textContent =
        `${pad2(horaInicio)}:00 - ${pad2(horaInicio + 1)}:00`;

    await cargarMateriasParaGrupo();

    const selectMateria = document.getElementById('modalSelectMateria');
    if (bloqueActual && bloqueActual.materia_id) {
        selectMateria.value = bloqueActual.materia_id;
    } else {
        selectMateria.value = '';
    }

    await cargarMaestrosParaMateria();

    const selectMaestro = document.getElementById('modalSelectMaestro');
    if (bloqueActual && bloqueActual.maestro_id) {
        selectMaestro.value = bloqueActual.maestro_id;
    } else {
        selectMaestro.value = '';
    }

    const btnEliminar = document.getElementById('btnEliminarClase');
    if (btnEliminar) {
        if (bloqueActual && bloqueActual.tipo === 'CLASE') {
            btnEliminar.style.display = 'inline-block';
        } else {
            btnEliminar.style.display = 'none';
        }
    }

    mostrarPanelEditar();
}

/* ================== MATERIAS Y MAESTROS ================== */

async function cargarMateriasParaGrupo() {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) return;

    const opt = selGrupo.options[selGrupo.selectedIndex];
    const semestre = parseInt(opt.dataset.semestre, 10);
    const grupoId = selGrupo.value;

    try {
        // 1. Obtener materias del semestre
        const resMat = await fetch(`/api/materias/semestre/${semestre}`);
        const materias = await resMat.json();

        // Guardarlas en cache (ya lo hacías)
        materias.forEach(m => {
            materiasCache[m.id] = m;
        });

        // 2. Obtener horas ya asignadas para ese grupo (solo conteo por materia)
        // DESPUÉS
        const resUsos = await fetch(`/api/horarios/materias/usadas-por-grupo/${grupoId}`);

        const usadasPorMateria = await resUsos.json();
        // Formato: { materia_id: usadas }

        const select = document.getElementById('modalSelectMateria');
        if (!select) return;

        select.innerHTML = '<option value="">(Dejar LIBRE)</option>';

        // 3. Meter materias que aún tengan horas disponibles
        materias.forEach(m => {
            const creditos = m.creditos || 0;
            const usadas = usadasPorMateria[m.id] || 0;

            // Ocultar materia si YA se asignaron todos sus créditos
            if (usadas >= creditos) {
                return; // NO se agrega al select
            }

            // Mostrar si le faltan horas
            const op = document.createElement('option');
            op.value = m.id;
            op.textContent = `${m.nombre} (${creditos} cr., usados ${usadas})`;
            select.appendChild(op);
        });

    } catch (err) {
        console.error('Error al cargar materias:', err);
        mostrarAlerta('Error al cargar materias para el panel.', 'danger');
    }
}


async function cargarMaestrosParaMateria() {
    const materiaId = document.getElementById('modalSelectMateria').value;
    const select = document.getElementById('modalSelectMaestro');
    if (!select) return;

    if (!materiaId) {
        select.innerHTML = '<option value="">Selecciona un maestro...</option>';
        return;
    }

    try {
        const res = await fetch(`/api/maestros-materias/por-materia/${materiaId}`);
        const lista = await res.json();

        select.innerHTML = '<option value="">Selecciona un maestro...</option>';

        lista.forEach(m => {
            const op = document.createElement('option');
            op.value = m.id;
            op.textContent = m.nombre;
            select.appendChild(op);
        });
    } catch (err) {
        console.error('Error al cargar maestros de la materia:', err);
        mostrarAlerta('Error al cargar maestros para la materia.', 'danger');
    }
}

/* ================== GUARDAR / ELIMINAR ================== */

async function editarSlotEnServidor(grupoId, diaBD, horaInicio, materiaId, maestroId) {
    const res = await fetch('/api/horarios/editar-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grupo_id: grupoId,
            dia: diaBD,
            hora_inicio: horaInicio,
            materia_id: materiaId || null,
            maestro_id: maestroId || null
        })
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.mensaje || 'Error al guardar bloque.');
    }

    return data;
}

async function guardarBloque() {
    const grupoId    = document.getElementById('modalGrupoId').value;
    const dia        = document.getElementById('modalDia').value;
    const horaInicio = document.getElementById('modalHoraInicio').value;
    const materiaId  = document.getElementById('modalSelectMateria').value;
    const maestroId  = document.getElementById('modalSelectMaestro').value;

    if (!grupoId || !dia || horaInicio === '') {
        mostrarAlerta('Selecciona primero una celda del horario.', 'warning');
        return;
    }

    const horaInt = parseInt(horaInicio, 10);

    // ===================== CASO 1: dejar LIBRE en todos los días =====================
    if (!materiaId) {
        try {
            const res = await fetch('/api/horarios/liberar-hora', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grupo_id: grupoId,
                    hora_inicio: horaInt
                })
            });

            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(
                    data.mensaje || 'Error al dejar libre la hora en toda la semana.',
                    'danger'
                );
                return;
            }

            mostrarAlerta(
                data.mensaje || 'Bloque actualizado a LIBRE en toda la semana.',
                'success'
            );
            ocultarPanelEditar();
            await cargarHorarioSeleccionado();
        } catch (err) {
            console.error('Error al llamar a /api/horarios/liberar-hora:', err);
            mostrarAlerta('Error al dejar libre la hora en toda la semana.', 'danger');
        }
        return;
    }

    // ===================== CASO 2: asignar materia =====================
    if (materiaId && !maestroId) {
        mostrarAlerta('Selecciona un maestro para la materia.', 'warning');
        return;
    }

    const materia  = materiasCache[materiaId];
    const creditos = materia ? (materia.creditos || 0) : 0;

    let diasObjetivoBD = [];

    if (creditos === 4) {
        // Lun–Jue
        diasObjetivoBD = DIAS_BD.slice(0, 4);
    } else if (creditos >= 5) {
        // Lun–Vie
        diasObjetivoBD = [...DIAS_BD];
    } else {
        // Materias de 1–3 créditos solo en el día seleccionado
        diasObjetivoBD = [dia];
    }

    // ========= LIMITE DE HORAS DEL MAESTRO =========
    try {
        // 1) Info del maestro (horas de contrato, etc.)
        const infoRes = await fetch(`/api/horarios/maestro-info/${maestroId}`);
        const infoMaestro = await infoRes.json();

        if (!infoRes.ok) {
            mostrarAlerta(
                infoMaestro.mensaje || 'Error al obtener información del maestro.',
                'danger'
            );
            return;
        }

        const horasContrato = Number(infoMaestro.horas_max_semana || 0);

        // 2) Horario actual del maestro (para contar horas reales)
        const horRes = await fetch(`/api/horarios/maestro/${maestroId}`);
        const bloquesMaestro = await horRes.json();

        let horasActuales = 0;
        if (horRes.ok && Array.isArray(bloquesMaestro)) {
            horasActuales = bloquesMaestro.length;
        } else {
            // fallback al valor de la consulta (por si algo falla)
            horasActuales = Number(infoMaestro.horas_asignadas || 0);
        }

        // 3) Calcular cuántos BLOQUES NUEVOS se agregarían a este maestro
        let nuevosSlots = 0;

        for (const diaBD of diasObjetivoBD) {
            const key = `${diaBD}-${horaInt}`;
            const lista = mapaBloques[key] || [];
            const existente = lista.find(b => String(b.grupo_id) === String(grupoId));

            if (!existente) {
                // No había nada en ese grupo/día/hora → se crea bloque nuevo para este maestro
                nuevosSlots++;
            } else if (String(existente.maestro_id) !== String(maestroId)) {
                // Había otro maestro, ahora este maestro tomará ese bloque
                nuevosSlots++;
                // (el otro maestro pierde 1 hora, pero aquí solo nos importa
                // que este gane 1 bloque más)
            }
            // Si ya era el mismo maestro, NO contamos nada, porque
            // ya está incluido en horasActuales.
        }

        const horasFinales = horasActuales + nuevosSlots;

        if (horasContrato > 0 && horasFinales > horasContrato) {
            mostrarAlerta(
                `Este maestro solo tiene ${horasContrato} h de contrato. ` +
                `Actualmente tiene ${horasActuales} h asignadas y estás intentando ` +
                `asignar ${nuevosSlots} bloque(s) más (total = ${horasFinales} h).`,
                'danger'
            );
            return;
        }
    } catch (err) {
        console.error('Error verificando límite de horas del maestro:', err);
        mostrarAlerta('No se pudo verificar el límite de horas del maestro.', 'danger');
        return;
    }

    // ========= SI PASÓ LA VALIDACIÓN, GUARDAMOS EN EL SERVIDOR =========
    const errores = [];

    for (const diaBD of diasObjetivoBD) {
        try {
            await editarSlotEnServidor(
                grupoId,
                diaBD,
                horaInt,
                materiaId,
                maestroId
            );
        } catch (err) {
            console.error(`Error al guardar en ${diaBD}:`, err);
            errores.push(`Día ${diaBD}: ${err.message}`);
        }
    }

    if (errores.length) {
        mostrarAlerta(
            'Algunos días no se pudieron actualizar:<br>' + errores.join('<br>'),
            'danger'
        );
    } else {
        mostrarAlerta('Bloque actualizado en todos los días correspondientes.', 'success');
    }

    ocultarPanelEditar();
    await cargarHorarioSeleccionado();
}



async function eliminarClaseActual() {
    if (!bloqueActual || bloqueActual.tipo !== 'CLASE') {
        mostrarAlerta('No hay clase que eliminar en este bloque.', 'warning');
        return;
    }

    if (!confirm('¿Seguro que deseas eliminar esta clase y dejar libre esta hora en TODOS los días?')) return;

    const grupoId = document.getElementById('modalGrupoId').value;
    const horaInicio = parseInt(document.getElementById('modalHoraInicio').value, 10);

    if (!grupoId || isNaN(horaInicio)) {
        mostrarAlerta('Datos inválidos para eliminar la clase.', 'danger');
        return;
    }

    try {
        const res = await fetch('/api/horarios/liberar-hora', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grupo_id: grupoId,
                hora_inicio: horaInicio
            })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al eliminar la materia en toda la semana.', 'danger');
            return;
        }

        mostrarAlerta(
            data.mensaje || 'Materia eliminada en todos los días de esa hora.',
            'success'
        );

        ocultarPanelEditar();
        await cargarHorarioSeleccionado();
    } catch (err) {
        console.error('Error al eliminar clase en toda la semana:', err);
        mostrarAlerta('Error al eliminar la clase en toda la semana.', 'danger');
    }
}

/* ================== VER HORARIO DEL MAESTRO ================== */

async function verHorarioMaestro() {
    const maestroId = document.getElementById('modalSelectMaestro').value;
    if (!maestroId) {
        mostrarAlerta('Selecciona un maestro primero.', 'warning');
        return;
    }

    try {
        const [infoRes, horarioRes] = await Promise.all([
            fetch(`/api/horarios/maestro-info/${maestroId}`),
            fetch(`/api/horarios/maestro/${maestroId}`)
        ]);

        const info = await infoRes.json();
        const data = await horarioRes.json();

        if (!infoRes.ok) {
            mostrarAlerta(info.mensaje || 'Error al obtener datos del maestro.', 'danger');
            return;
        }
        if (!horarioRes.ok) {
            mostrarAlerta(data.mensaje || 'Error al cargar horario del maestro.', 'danger');
            return;
        }

        const cont = document.getElementById('contenedorHorarioMaestro');
        if (!cont) return;

        const horasContrato = Number(info.horas_max_semana || info.horas_contrato || 0);
        const horasAsignadas = Number(info.horas_asignadas || 0);
        const horasLibres = Math.max(horasContrato - horasAsignadas, 0);

        let resumenHTML = `
                <div class="mb-3">
                    <div><strong>${info.nombre}</strong></div>
                    <span class="badge bg-primary me-2">Contrato: ${horasContrato} h</span>
                    <span class="badge bg-success me-2">Asignadas: ${horasAsignadas} h</span>
                    <span class="badge bg-warning text-dark">Disponibles: ${horasLibres} h</span>
                </div>
            `;

        if (!data.length) {
            cont.innerHTML = `
                    ${resumenHTML}
                    <p class="text-center text-muted mb-0">
                        Este maestro no tiene clases asignadas todavía.
                    </p>
                `;
            if (modalHorarioMaestro) modalHorarioMaestro.show();
            return;
        }

        const mapa = {};
        data.forEach(b => {
            const hora = obtenerHoraDesdeCampo(b.hora_inicio);
            if (hora == null) return;
            const diaKey = b.dia === 'Miercoles' ? 'Miércoles' : b.dia;
            const key = `${diaKey}-${hora}`;
            mapa[key] = b;
        });

        let html = `
                ${resumenHTML}
                <div class="table-responsive">
                    <table class="table table-sm table-bordered mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Hora</th>
                                ${DIAS.map(d => `<th>${d}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

        for (let h = HORA_INICIO; h < HORA_FIN; h++) {
            html += `<tr><th scope="row">${pad2(h)}:00 - ${pad2(h + 1)}:00</th>`;
            DIAS.forEach(dia => {
                const key = `${dia}-${h}`;
                const b = mapa[key];
                if (!b) {
                    html += '<td class="text-muted">Libre</td>';
                } else {
                    html += `
        <td>
            <div style="font-size:0.8rem;font-weight:600;">
                ${b.materia || b.materia_nombre || 'Materia'}
            </div>
            <div style="font-size:0.7rem;opacity:.8;">
                Salón ${b.salon || b.salon_clave || '-'}
            </div>
            <div style="font-size:0.7rem;opacity:.8;">${dia}</div>

            <button class="btn btn-danger btn-sm mt-1"
                onclick="eliminarClaseDeMaestro(${b.id})">
                Eliminar
            </button>
        </td>
    `;

                }
            });
            html += '</tr>';
        }

        html += `
                        </tbody>
                    </table>
                </div>
            `;

        cont.innerHTML = html;
        if (modalHorarioMaestro) modalHorarioMaestro.show();

    } catch (err) {
        console.error('Error al cargar horario del maestro:', err);
        mostrarAlerta('Error al cargar horario del maestro.', 'danger');
    }
}

async function eliminarClaseDeMaestro(horarioId) {
    if (!horarioId) {
        mostrarAlerta("ID de clase inválido", "danger");
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar esta clase del maestro?")) return;

    try {
        const res = await fetch('/api/horarios/eliminar-clase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ horario_id: horarioId })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || "Error al eliminar la clase.", "danger");
            return;
        }

        mostrarAlerta(data.mensaje || "Clase eliminada correctamente.", "success");

        // Recargar horario del maestro
        verHorarioMaestro();

    } catch (err) {
        console.error("Error eliminando clase:", err);
        mostrarAlerta("Error al eliminar clase.", "danger");
    }
}
/* ================== UTILIDADES UI ================== */

function mostrarAlerta(msg, tipo = 'info') {
    // Creamos el contenedor de toasts si no existe
    let cont = document.getElementById('toast-container');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toast-container';
        document.body.appendChild(cont);
    }

    // Creamos el toast
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${tipo}`;
    toast.innerHTML = msg; // puede contener <br> etc.

    // Al hacer clic se cierra inmediato
    toast.addEventListener('click', () => {
        toast.classList.add('app-toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    });

    cont.appendChild(toast);

    // Auto-cerrar en 3 segundos
    setTimeout(() => {
        toast.classList.add('app-toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

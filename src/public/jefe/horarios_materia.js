
// public/jefe/horarios_materia.js

// =================== CONSTANTES ===================

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_BD = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

const HORA_INICIO = 7;  // 07:00
const HORA_FIN = 15;    // hasta 14:00-15:00

// mapa: "DiaBD-hora" -> [bloques...]
let mapaBloques = {};
let gruposMateriaCache = [];  // /api/grupos-materia?semestre=...
let materiasCache = {};       // materia_id -> {id, nombre, creditos}
let salonesCache = [];

// UI
let panelEditar = null;
let modalHorarioMaestro = null;
let modalHorarioSalon = null;
let celdaSeleccionada = null;

// NUEVO: modo del panel (agregar / eliminar)
let modoPanel = 'agregar';
let selectEliminarGrupo = null;

// =================== INICIO ===================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ horarios_materia.js (jefe) cargado');

    panelEditar = document.getElementById('panelEditarBloque');

    const modalMaestroEl = document.getElementById('modalHorarioMaestro');
    if (modalMaestroEl) {
        modalHorarioMaestro = new bootstrap.Modal(modalMaestroEl);
    }

    const modalSalonEl = document.getElementById('modalHorarioSalon');
    if (modalSalonEl) {
        modalHorarioSalon = new bootstrap.Modal(modalSalonEl);
    }

    construirTablaVacia();

    // Inicializar UI de modos (Agregar / Eliminar grupos)
    inicializarUIEliminacionGrupos();

    // Cambio de semestre
    const selSemestre = document.getElementById('selectSemestre');
    if (selSemestre) {
        selSemestre.addEventListener('change', async () => {
            await cargarGruposPorSemestre();
            await cargarHorarioSemestre();
            llenarHorasPanel();
        });
    }

    // Cambio de grupo de materia en el panel (modo agregar)
    const selGrupo = document.getElementById('selectGrupo');
    if (selGrupo) {
        selGrupo.addEventListener('change', async () => {
            if (!selGrupo.value) {
                mostrarCompletitud(
                    'Selecciona un grupo de materia para ver cuántas horas lleva asignadas.',
                    'info'
                );
                prepararPanelParaGrupoSeleccionado();
                actualizarBotonEliminarGrupo();
                return;
            }

            prepararPanelParaGrupoSeleccionado();

            const opt = selGrupo.options[selGrupo.selectedIndex];
            await evaluarCompletitudMateriaGrupo(selGrupo.value, opt);
            actualizarBotonEliminarGrupo();
        });
    }

    // Click en celdas de la tabla (solo para resaltar/ver info)
    const tbody = document.getElementById('tbodyHorario');
    if (tbody) {
        tbody.addEventListener('click', onClickCelda);
    }

    // Click global para quitar selección de celda
    document.addEventListener('click', (ev) => {
        const dentroTabla = ev.target.closest('#tablaHorario');
        const dentroPanel = ev.target.closest('#panelEditarBloque');
        const dentroModalMaestro = ev.target.closest('#modalHorarioMaestro');
        const dentroModalSalon = ev.target.closest('#modalHorarioSalon');

        if (dentroTabla || dentroPanel || dentroModalMaestro || dentroModalSalon) return;

        if (celdaSeleccionada) {
            celdaSeleccionada.classList.remove('celda-seleccionada');
            celdaSeleccionada = null;
        }
    });

    // Botones del panel (modo agregar)
    const btnVerHorarioMaestro = document.getElementById('btnVerHorarioMaestro');
    if (btnVerHorarioMaestro) {
        btnVerHorarioMaestro.addEventListener('click', verHorarioMaestro);
    }

    const btnVerHorarioSalon = document.getElementById('btnVerHorarioSalon');
    if (btnVerHorarioSalon) {
        btnVerHorarioSalon.addEventListener('click', verHorarioSalon);
    }

    const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');
    if (btnCancelarEdicion) {
        btnCancelarEdicion.addEventListener('click', limpiarPanel);
    }

    const btnEliminarGrupoCompleto = document.getElementById('btnEliminarGrupoCompleto');
    if (btnEliminarGrupoCompleto) {
        btnEliminarGrupoCompleto.style.display = 'none';
        btnEliminarGrupoCompleto.addEventListener('click', () => eliminarHorarioGrupoCompleto());
    }

    const btnEliminarBloque = document.getElementById('btnEliminarBloque');
    if (btnEliminarBloque) {
        btnEliminarBloque.addEventListener('click', eliminarBloquePorHora);
    }

    // Cargar datos base
    cargarSalones();
    llenarHorasPanel(); // por si ya hay semestre seleccionado

    mostrarAlerta(
        'Selecciona un <strong>semestre</strong>. El horario mostrará todos los grupos del semestre; en el panel eliges cuál editar o eliminar.',
        'info'
    );
});

// =================== UTILIDADES GENERALES ===================

function pad2(n) {
    return n.toString().padStart(2, '0');
}

// Toast flotante
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

function mostrarCompletitud(msg, tipo = 'info') {
    const cont = document.getElementById('alert-completitud');
    if (!cont) return;
    cont.innerHTML = msg
        ? `<div class="alert alert-${tipo}" role="alert">${msg}</div>`
        : '';
}

function diaBDaNombre(diaBD) {
    return diaBD === 'Miercoles' ? 'Miércoles' : diaBD;
}

function obtenerHoraDesdeCampo(horaStr) {
    if (!horaStr) return null;
    const partes = horaStr.split(':');
    const h = parseInt(partes[0], 10);
    return isNaN(h) ? null : h;
}

function obtenerRecesoPorSemestre() {
    const selSem = document.getElementById('selectSemestre');
    if (!selSem) return null;

    const sem = parseInt(selSem.value, 10);
    if (isNaN(sem)) return null;

    if (sem >= 1 && sem <= 3) return 11;
    if (sem >= 4 && sem <= 6) return 12;
    if (sem >= 7 && sem <= 9) return 13;

    return null;
}

// =================== UI: MODO AGREGAR / ELIMINAR GRUPOS ===================

function inicializarUIEliminacionGrupos() {
    if (!panelEditar) return;

    const cardBody = panelEditar.querySelector('.card-body');
    const cardFooter = panelEditar.querySelector('.card-footer');
    if (!cardBody) return;

    // Contenedor de botones de modo
    const contModos = document.createElement('div');
    contModos.className = 'mb-3 d-flex gap-2 flex-wrap';
    contModos.innerHTML = `
        <button id="btnModoAgregarGrupos" type="button" class="btn btn-sm btn-primary-custom">
            Agregar grupos al horario
        </button>
        <button id="btnModoEliminarGrupos" type="button" class="btn btn-sm btn-outline-danger">
            Eliminar grupos del horario
        </button>
    `;
    cardBody.prepend(contModos);

    // Sección de eliminar grupos del horario
    const seccionEliminar = document.createElement('div');
    seccionEliminar.id = 'seccionEliminarGrupos';
    seccionEliminar.className = 'mb-3';
    seccionEliminar.style.display = 'none';
    seccionEliminar.innerHTML = `
        <label class="form-label">Grupo con horario</label>
        <select id="selectGrupoEliminar" class="form-select mb-2">
            <option value="">Selecciona un grupo con horario...</option>
        </select>
        <div class="form-text mb-2">
            Solo se muestran grupos que ya tienen al menos una clase asignada en el horario actual.
        </div>
        <button id="btnEliminarGrupoHorario" type="button" class="btn btn-outline-danger w-100">
            Eliminar grupo del horario
        </button>
        <hr>
    `;
    cardBody.insertBefore(seccionEliminar, contModos.nextSibling);

    selectEliminarGrupo = seccionEliminar.querySelector('#selectGrupoEliminar');

    const btnAgregar = document.getElementById('btnModoAgregarGrupos');
    const btnEliminar = document.getElementById('btnModoEliminarGrupos');
    const btnEliminarGrupoHorario = document.getElementById('btnEliminarGrupoHorario');

    if (btnAgregar) {
        btnAgregar.addEventListener('click', () => cambiarModoPanel('agregar'));
    }
    if (btnEliminar) {
        btnEliminar.addEventListener('click', () => cambiarModoPanel('eliminar'));
    }
    if (btnEliminarGrupoHorario) {
        btnEliminarGrupoHorario.addEventListener('click', async () => {
            if (!selectEliminarGrupo || !selectEliminarGrupo.value) {
                mostrarAlerta('Selecciona un grupo con horario para eliminarlo.', 'warning');
                return;
            }
            await eliminarHorarioGrupoCompleto(selectEliminarGrupo.value);
        });
    }

    // Arrancamos en modo agregar
    cambiarModoPanel('agregar');
}

function cambiarModoPanel(nuevoModo) {
    modoPanel = nuevoModo;

    if (!panelEditar) return;

    const seccionEliminar = document.getElementById('seccionEliminarGrupos');
    const cardFooter = panelEditar.querySelector('.card-footer');
    const btnAgregar = document.getElementById('btnModoAgregarGrupos');
    const btnEliminar = document.getElementById('btnModoEliminarGrupos');

    // Bloques del modo "agregar"
    const bloqueGrupo = document.getElementById('selectGrupo')?.closest('.mb-3') || null;
    const bloqueResumen = document.getElementById('modalGrupoTexto')?.closest('.mb-2') || null;
    const bloqueHora = document.getElementById('modalHoraManual')?.closest('.mb-3') || null;
    const bloqueMateria = document.getElementById('modalSelectMateria')?.closest('.mb-3') || null;
    const bloqueMaestro = document.getElementById('modalSelectMaestro')?.closest('.mb-3') || null;
    const bloqueSalon = document.getElementById('modalSelectSalon')?.closest('.mb-3') || null;
    const bloqueBotonesConsulta = document.getElementById('btnVerHorarioMaestro')
        ? document.getElementById('btnVerHorarioMaestro').closest('.d-flex')
        : null;

    if (modoPanel === 'agregar') {
        // Mostrar bloques de agregar
        if (seccionEliminar) seccionEliminar.style.display = 'none';
        if (bloqueGrupo) bloqueGrupo.style.display = '';
        if (bloqueResumen) bloqueResumen.style.display = '';
        if (bloqueHora) bloqueHora.style.display = '';
        if (bloqueMateria) bloqueMateria.style.display = '';
        if (bloqueMaestro) bloqueMaestro.style.display = '';
        if (bloqueSalon) bloqueSalon.style.display = '';
        if (bloqueBotonesConsulta) bloqueBotonesConsulta.style.display = '';
        if (cardFooter) cardFooter.style.display = 'flex';

        if (btnAgregar) {
            btnAgregar.classList.add('btn-primary-custom');
            btnAgregar.classList.remove('btn-outline-primary-custom');
        }
        if (btnEliminar) {
            btnEliminar.classList.remove('btn-primary-custom');
            btnEliminar.classList.add('btn-outline-danger');
        }
    } else {
        // Modo eliminar grupos
        if (seccionEliminar) seccionEliminar.style.display = '';
        if (bloqueGrupo) bloqueGrupo.style.display = 'none';
        if (bloqueResumen) bloqueResumen.style.display = 'none';
        if (bloqueHora) bloqueHora.style.display = 'none';
        if (bloqueMateria) bloqueMateria.style.display = 'none';
        if (bloqueMaestro) bloqueMaestro.style.display = 'none';
        if (bloqueSalon) bloqueSalon.style.display = 'none';
        if (bloqueBotonesConsulta) bloqueBotonesConsulta.style.display = 'none';
        if (cardFooter) cardFooter.style.display = 'none';

        if (btnAgregar) {
            btnAgregar.classList.remove('btn-primary-custom');
            btnAgregar.classList.add('btn-outline-primary-custom');
        }
        if (btnEliminar) {
            btnEliminar.classList.add('btn-primary-custom');
            btnEliminar.classList.remove('btn-outline-danger');
        }

        // actualizar lista de grupos con horario
        refrescarSelectGruposConHorario();
    }
}

function refrescarSelectGruposConHorario() {
    if (!selectEliminarGrupo) {
        selectEliminarGrupo = document.getElementById('selectGrupoEliminar');
    }
    if (!selectEliminarGrupo) return;

    const gruposConHorario = new Set();
    const infoGrupo = {};

    for (const key in mapaBloques) {
        const arr = mapaBloques[key];
        if (!Array.isArray(arr)) continue;

        arr.forEach(b => {
            if (!b.grupo_id) return;
            const id = String(b.grupo_id);

            if (!gruposConHorario.has(id)) {
                gruposConHorario.add(id);

                let texto = '';
                const gm = gruposMateriaCache.find(x => String(x.id) === id);
                if (gm) {
                    texto = `${gm.materia_nombre} (${gm.nombre_grupo})`;
                } else {
                    const grupoTag = b.nombre_grupo ? `(${b.nombre_grupo})` : '';
                    texto = `${b.materia_nombre || 'Materia'} ${grupoTag}`;
                }
                infoGrupo[id] = texto;
            }
        });
    }

    selectEliminarGrupo.innerHTML =
        '<option value="">Selecciona un grupo con horario...</option>';

    if (gruposConHorario.size === 0) {
        const op = document.createElement('option');
        op.value = '';
        op.textContent = 'No hay grupos con clases en este horario.';
        selectEliminarGrupo.appendChild(op);
        return;
    }

    Array.from(gruposConHorario).sort().forEach(id => {
        const op = document.createElement('option');
        op.value = id;
        op.textContent = infoGrupo[id] || `Grupo ${id}`;
        selectEliminarGrupo.appendChild(op);
    });
}

// =================== HORAS EN EL PANEL ===================

function llenarHorasPanel() {
    const selHoraManual = document.getElementById('modalHoraManual');
    if (!selHoraManual) return;

    const recesoHour = obtenerRecesoPorSemestre();

    selHoraManual.innerHTML = '<option value="">Selecciona una hora...</option>';

    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
        if (recesoHour !== null && h === recesoHour) continue;

        const op = document.createElement('option');
        op.value = h;
        op.textContent = `${pad2(h)}:00 - ${pad2(h + 1)}:00`;
        selHoraManual.appendChild(op);
    }
}

// =================== PANEL EDITOR (modo agregar) ===================

function limpiarPanel() {
    const selMae = document.getElementById('modalSelectMaestro');
    const selSalon = document.getElementById('modalSelectSalon');
    const selHora = document.getElementById('modalHoraManual');

    if (selMae) selMae.value = '';
    if (selSalon) selSalon.value = '';
    if (selHora) selHora.value = '';

    document.getElementById('modalGrupoId').value = '';
    document.getElementById('modalDia').value = '';
    document.getElementById('modalHoraInicio').value = '';
    document.getElementById('modalMateriaId').value = '';
    document.getElementById('modalGrupoTexto').textContent = '';
    document.getElementById('modalMateriaTexto').textContent = '';
    document.getElementById('modalDiaTexto').textContent = '';
    document.getElementById('modalHoraTexto').textContent = '';

    if (celdaSeleccionada) {
        celdaSeleccionada.classList.remove('celda-seleccionada');
        celdaSeleccionada = null;
    }
}

// Se llama cuando cambias el selectGrupo
function prepararPanelParaGrupoSeleccionado() {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo || !selGrupo.value) {
        limpiarPanel();
        return;
    }

    const opt = selGrupo.options[selGrupo.selectedIndex];
    const grupoId = selGrupo.value;
    const materiaId = opt.dataset.materiaId;
    const materiaNombre = opt.dataset.materiaNombre;
    const grupoTexto = opt.dataset.grupoTexto;

    document.getElementById('modalGrupoId').value = grupoId;
    document.getElementById('modalMateriaId').value = materiaId || '';
    document.getElementById('modalGrupoTexto').textContent = grupoTexto || '';
    document.getElementById('modalMateriaTexto').textContent = materiaNombre || '';
    document.getElementById('modalDiaTexto').textContent = '';
    document.getElementById('modalHoraTexto').textContent = '';

    const selMat = document.getElementById('modalSelectMateria');
    if (selMat) {
        selMat.innerHTML = '';
        const op = document.createElement('option');
        op.value = materiaId || '';
        op.textContent = materiaNombre || '(Sin materia)';
        selMat.appendChild(op);
        selMat.value = materiaId || '';
    }

    // Cargar maestros que pueden dar esta materia
    cargarMaestrosParaMateria();
}

// =================== CARGAR SALONES ===================

async function cargarSalones() {
    const select = document.getElementById('modalSelectSalon');
    if (!select) return;

    try {
        const res = await fetch('/api/salones');
        if (!res.ok) {
            console.error('Error al cargar salones (status != 200)');
            select.innerHTML = '<option value="">Error al cargar salones</option>';
            return;
        }

        salonesCache = await res.json();
        select.innerHTML = '<option value="">Selecciona un salón...</option>';

        salonesCache.forEach(s => {
            const op = document.createElement('option');
            op.value = s.id;
            op.textContent = s.clave || s.nombre || `Salón ${s.id}`;
            select.appendChild(op);
        });
    } catch (err) {
        console.error('Error al cargar salones:', err);
        select.innerHTML = '<option value="">Error al cargar salones</option>';
    }
}

// =================== TABLA VACÍA ===================

function construirTablaVacia() {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    if (celdaSeleccionada) {
        celdaSeleccionada.classList.remove('celda-seleccionada');
        celdaSeleccionada = null;
    }

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

// =================== CARGAR GRUPOS POR SEMESTRE ===================

async function cargarGruposPorSemestre() {
    const selSem = document.getElementById('selectSemestre');
    const selGrupo = document.getElementById('selectGrupo');
    if (!selSem || !selGrupo) return;

    const semestre = selSem.value;
    selGrupo.innerHTML = '<option value="">Selecciona un grupo...</option>';

    gruposMateriaCache = [];
    materiasCache = {};
    limpiarPanel();
    mostrarCompletitud('');

    if (!semestre) {
        mostrarAlerta('Selecciona un semestre para ver sus grupos de materia.', 'info');
        return;
    }

    try {
        const res = await fetch(`/api/grupos-materia?semestre=${semestre}`);
        if (!res.ok) {
            mostrarAlerta('Error al cargar grupos del semestre.', 'danger');
            return;
        }

        gruposMateriaCache = await res.json();

        if (!gruposMateriaCache.length) {
            mostrarAlerta('Este semestre aún no tiene grupos configurados.', 'warning');
            return;
        }

        gruposMateriaCache.forEach(g => {
            materiasCache[g.materia_id] = {
                id: g.materia_id,
                nombre: g.materia_nombre,
                creditos: g.materia_creditos
            };

            const opt = document.createElement('option');
            opt.value = g.id; // id de grupos_materia
            opt.textContent = `${g.materia_nombre} (${g.nombre_grupo})`;
            opt.dataset.semestre = g.semestre;
            opt.dataset.materiaId = g.materia_id;
            opt.dataset.materiaNombre = g.materia_nombre;
            opt.dataset.materiaCreditos = g.materia_creditos;
            opt.dataset.nombreGrupo = g.nombre_grupo;
            opt.dataset.grupoTexto = opt.textContent;
            selGrupo.appendChild(opt);
        });

        mostrarAlerta(
            'En el panel elige el <strong>grupo de materia</strong> que vas a editar. El horario muestra TODOS los grupos del semestre.',
            'success'
        );
    } catch (err) {
        console.error('Error al cargar grupos_materia:', err);
        mostrarAlerta('Error al cargar grupos de la materia.', 'danger');
    }
}

// =================== CARGAR HORARIO DEL SEMESTRE ===================

async function cargarHorarioSemestre() {
    const selSem = document.getElementById('selectSemestre');
    const selGrupo = document.getElementById('selectGrupo');

    if (!selSem) {
        mostrarAlerta('No se encontró el selector de semestre.', 'danger');
        return;
    }

    const semestre = selSem.value;
    if (!semestre) {
        construirTablaVacia();
        mostrarCompletitud('');
        refrescarSelectGruposConHorario();
        return;
    }

    construirTablaVacia();
    limpiarPanel();
    mostrarCompletitud('');

    try {
        const res = await fetch(`/api/horarios/semestre/${semestre}`);
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

            const diaBD = b.dia;
            const key = `${diaBD}-${hora}`;
            if (!mapaBloques[key]) mapaBloques[key] = [];
            mapaBloques[key].push(b);
        });

        renderizarMapaEnTabla();
        pintarRecesosVirtuales(parseInt(semestre, 10));

        if (selGrupo && selGrupo.value) {
            const opt = selGrupo.options[selGrupo.selectedIndex];
            await evaluarCompletitudMateriaGrupo(selGrupo.value, opt);
        } else {
            mostrarCompletitud(
                'Selecciona un grupo de materia para ver cuántas horas lleva asignadas.',
                'info'
            );
        }

        actualizarBotonEliminarGrupo();
        refrescarSelectGruposConHorario();
    } catch (err) {
        console.error('Error al cargar horario:', err);
        mostrarAlerta('Error al cargar horario (fallo de red o servidor caído).', 'danger');
    }
}

function renderizarMapaEnTabla() {
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    Object.keys(mapaBloques).forEach(key => {
        const [diaBD, horaStr] = key.split('-');
        const hora = parseInt(horaStr, 10);

        const filaIndex = hora - HORA_INICIO;
        if (filaIndex < 0 || filaIndex >= (HORA_FIN - HORA_INICIO)) return;
        const fila = tbody.rows[filaIndex];

        const diaNombre = diaBDaNombre(diaBD);
        const diaIndex = DIAS.indexOf(diaNombre);
        if (diaIndex === -1) return;

        const celda = fila.cells[diaIndex + 1];
        const bloques = mapaBloques[key];

        celda.className = '';
        celda.classList.add('celda-clase');

        const html = `
            <div class="celda-multi-grupo">
                ${bloques.map(b => {
                    const grupoTag = b.nombre_grupo ? `(${b.nombre_grupo})` : '';
                    return `
                        <div class="bloque-grupo" data-grupo-id="${b.grupo_id}">
                            <div class="nombre-materia">
                                ${b.materia_nombre || 'Materia'} ${grupoTag}
                            </div>
                            <div class="nombre-maestro">
                                ${b.maestro_nombre || 'Maestro'}
                            </div>
                            <div class="nombre-salon">
                                Salón ${b.salon_clave || '-'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        celda.innerHTML = html;
    });
}

function pintarRecesosVirtuales(semestre) {
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

// =================== COMPLETITUD Y SELECT GRUPO ===================

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

function ocultarGrupoEnSelector(grupoId) {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) return;

    const valor = String(grupoId);
    const opt = selGrupo.querySelector(`option[value="${valor}"]`);
    if (!opt) return;

    if (selGrupo.value === valor) {
        selGrupo.value = '';
        limpiarPanel();
        mostrarCompletitud(
            'Selecciona un grupo de materia para ver cuántas horas lleva asignadas.',
            'info'
        );
    }

    selGrupo.removeChild(opt);
}

function asegurarGrupoEnSelect(grupoId) {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) return null;

    const valor = String(grupoId);
    let opt = selGrupo.querySelector(`option[value="${valor}"]`);
    if (opt) return opt;

    const g = gruposMateriaCache.find(x => String(x.id) === valor);
    if (!g) return null;

    opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.materia_nombre} (${g.nombre_grupo})`;
    opt.dataset.semestre = g.semestre;
    opt.dataset.materiaId = g.materia_id;
    opt.dataset.materiaNombre = g.materia_nombre;
    opt.dataset.materiaCreditos = g.materia_creditos;
    opt.dataset.nombreGrupo = g.nombre_grupo;
    opt.dataset.grupoTexto = opt.textContent;

    selGrupo.appendChild(opt);
    return opt;
}

async function evaluarCompletitudMateriaGrupo(grupoId, optGrupo) {
    if (!optGrupo) return;

    const materiaId = parseInt(optGrupo.dataset.materiaId, 10);
    const materiaNombre = optGrupo.dataset.materiaNombre;
    const creditos = parseInt(optGrupo.dataset.materiaCreditos || '0', 10);

    if (!materiaId || !creditos) {
        mostrarCompletitud('No se pudieron determinar los créditos de la materia.', 'warning');
        return;
    }

    try {
        const resUsos = await fetch(`/api/horarios/materias/usadas-por-grupo/${grupoId}`);
        const usadasPorMateria = await resUsos.json(); // { materia_id: usadas }

        const usadas = usadasPorMateria[materiaId] || 0;

        if (usadas >= creditos) {
            mostrarCompletitud(
                `Horas completas para <strong>${materiaNombre}</strong> en este grupo: ` +
                `${usadas}/${creditos} h. La materia se ocultó del listado de grupos para evitar duplicarla.`,
                'success'
            );
            ocultarGrupoEnSelector(grupoId);
        } 
    } catch (err) {
        console.error('Error al verificar horas de la materia:', err);
        mostrarCompletitud('No se pudo verificar las horas de la materia.', 'danger');
    }
}

// =================== CLICK EN CELDAS ===================

function onClickCelda(ev) {
    if (modoPanel !== 'agregar') {
        mostrarAlerta('Estás en modo "Eliminar grupos". Cambia a "Agregar grupos al horario" para editar bloques.', 'warning');
        return;
    }

    const selGrupo = document.getElementById('selectGrupo');
    const td = ev.target.closest('td');
    if (!td) return;

    if (!selGrupo || !selGrupo.value) {
        mostrarAlerta('Selecciona primero el grupo de materia que quieres editar en el panel.', 'warning');
        return;
    }

    const fila = td.parentElement;
    const tbody = document.getElementById('tbodyHorario');
    if (!tbody) return;

    const filaIndex = Array.from(tbody.rows).indexOf(fila);
    const horaInicio = HORA_INICIO + filaIndex;

    const colIndex = td.cellIndex;
    if (colIndex === 0) return;

    const dia = DIAS[colIndex - 1];

    if (td.classList.contains('celda-receso')) {
        return;
    }

    if (celdaSeleccionada && celdaSeleccionada !== td) {
        celdaSeleccionada.classList.remove('celda-seleccionada');
    }
    celdaSeleccionada = td;
    td.classList.add('celda-seleccionada');

    const grupoIdSeleccionado = selGrupo.value;

    td.querySelectorAll('.bloque-grupo-activo').forEach(div => {
        div.classList.remove('bloque-grupo-activo');
    });

    const bloqueVisual = td.querySelector(`.bloque-grupo[data-grupo-id="${grupoIdSeleccionado}"]`);
    if (bloqueVisual) {
        bloqueVisual.classList.add('bloque-grupo-activo');
    }

    abrirEditorBloque(dia, horaInicio);
}

async function abrirEditorBloque(diaNombre, horaInicio) {
    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo) {
        mostrarAlerta('No se encontró el selector de grupo.', 'danger');
        return;
    }

    const grupoId = selGrupo.value;
    if (!grupoId) {
        mostrarAlerta('Selecciona un grupo primero en el panel.', 'warning');
        return;
    }

    const opt = selGrupo.options[selGrupo.selectedIndex];
    const grupoTexto = opt.dataset.grupoTexto;
    const materiaId = parseInt(opt.dataset.materiaId, 10);
    const materiaNombre = opt.dataset.materiaNombre;

    const diaBD = diaNombre === 'Miércoles' ? 'Miercoles' : diaNombre;
    const key = `${diaBD}-${horaInicio}`;
    const listaBloques = mapaBloques[key] || [];
    const bloqueActual = listaBloques.find(b => String(b.grupo_id) === String(grupoId)) || null;

    document.getElementById('modalGrupoId').value = grupoId;
    document.getElementById('modalDia').value = diaBD;
    document.getElementById('modalHoraInicio').value = horaInicio;
    document.getElementById('modalMateriaId').value = materiaId;

    document.getElementById('modalGrupoTexto').textContent = grupoTexto;
    document.getElementById('modalMateriaTexto').textContent = materiaNombre;
    document.getElementById('modalDiaTexto').textContent = diaNombre;
    document.getElementById('modalHoraTexto').textContent =
        `${pad2(horaInicio)}:00 - ${pad2(horaInicio + 1)}:00`;

    const selMat = document.getElementById('modalSelectMateria');
    if (selMat) {
        selMat.innerHTML = '';
        const op = document.createElement('option');
        op.value = materiaId;
        op.textContent = materiaNombre;
        selMat.appendChild(op);
        selMat.value = materiaId;
    }

    await cargarMaestrosParaMateria();

    const selMae = document.getElementById('modalSelectMaestro');
    if (bloqueActual && bloqueActual.maestro_id && selMae) {
        selMae.value = String(bloqueActual.maestro_id);
    } else if (selMae) {
        selMae.value = '';
    }

    const selSalon = document.getElementById('modalSelectSalon');
    if (selSalon) {
        if (bloqueActual && bloqueActual.salon_id) {
            selSalon.value = String(bloqueActual.salon_id);
        } else {
            selSalon.value = '';
        }
    }

    const selHoraManual = document.getElementById('modalHoraManual');
    if (selHoraManual) {
        // Sincronizar el select con la hora elegida en la tabla
        selHoraManual.value = String(horaInicio);
    }
}


// =================== MAESTROS ===================

async function cargarMaestrosParaMateria() {
    const materiaId = document.getElementById('modalMateriaId').value;
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

// =================== GUARDAR / ELIMINAR BLOQUE ===================

async function editarSlotEnServidor(grupoId, diaBD, horaInicio, materiaId, maestroId, salonId) {
    const res = await fetch('/api/horarios/editar-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grupo_id: grupoId,
            dia: diaBD,
            hora_inicio: horaInicio,
            materia_id: materiaId || null,
            maestro_id: maestroId || null,
            salon_id: salonId || null
        })
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.mensaje || 'Error al guardar bloque.');
    }

    return data;
}

// ✅ Esta función la llama el botón "Guardar cambios" (inline en el HTML)
async function guardarBloque() {
    if (modoPanel !== 'agregar') {
        mostrarAlerta('Para guardar bloques debes estar en modo "Agregar grupos al horario".', 'warning');
        return;
    }

    const selGrupo = document.getElementById('selectGrupo');
    const grupoId  = selGrupo ? selGrupo.value : '';
    const materiaId = parseInt(document.getElementById('modalMateriaId').value, 10);
    const maestroId = document.getElementById('modalSelectMaestro').value;
    const salonId   = document.getElementById('modalSelectSalon').value;

    if (!grupoId) {
        mostrarAlerta('Selecciona primero un grupo de materia en el panel.', 'warning');
        return;
    }

    // 🔹 Hora tomada de la celda clickeada
    const horaStr = document.getElementById('modalHoraInicio').value;
    if (!horaStr) {
        mostrarAlerta('Haz clic en una celda del horario (día y hora) antes de guardar.', 'warning');
        return;
    }

    let horaInicio = parseInt(horaStr, 10);
    if (isNaN(horaInicio)) {
        mostrarAlerta('La hora seleccionada no es válida.', 'danger');
        return;
    }

    const recesoHour = obtenerRecesoPorSemestre();
    if (recesoHour !== null && horaInicio === recesoHour) {
        mostrarAlerta('No puedes asignar clases en la hora de RECESO.', 'warning');
        return;
    }

    if (!materiaId) {
        mostrarAlerta('No se pudo determinar la materia del grupo.', 'danger');
        return;
    }
    if (!maestroId) {
        mostrarAlerta('Selecciona un maestro para la materia.', 'warning');
        return;
    }
    if (!salonId) {
        mostrarAlerta('Selecciona un salón para la clase.', 'warning');
        return;
    }

    const materia  = materiasCache[materiaId];
    const creditos = materia ? (materia.creditos || 0) : 0;

    // ================== DÍAS SEGÚN CRÉDITOS ==================
    let diasObjetivoBD = [];
    if (creditos === 4) {
        // 4 créditos → Lunes a Jueves
        diasObjetivoBD = DIAS_BD.slice(0, 4);
    } else {
        // 5 o más → Lunes a Viernes
        diasObjetivoBD = [...DIAS_BD];
    }

    // ================== LIMITE DE HORAS DEL MAESTRO ==================
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

        const horasContrato = Number(
            infoMaestro.horas_max_semana ||
            infoMaestro.horas_contrato ||
            0
        );

        // 2) Horario actual del maestro (para contar horas REALES)
        const horRes = await fetch(`/api/horarios/maestro/${maestroId}`);
        const bloquesMaestro = await horRes.json();

        let horasActuales = 0;
        if (horRes.ok && Array.isArray(bloquesMaestro)) {
            horasActuales = bloquesMaestro.length;
        } else {
            horasActuales = Number(infoMaestro.horas_asignadas || 0);
        }

        // 3) Calcular cuántos BLOQUES NUEVOS se le agregarían
        let nuevosSlots = 0;

        for (const diaBD of diasObjetivoBD) {
            const key   = `${diaBD}-${horaInicio}`;
            const lista = mapaBloques[key] || [];

            // Buscamos si YA hay un bloque de este grupo en ese día/hora
            const existente = lista.find(
                b => String(b.grupo_id) === String(grupoId)
            );

            if (!existente) {
                // No había nada para ese grupo → este maestro gana 1 hora nueva
                nuevosSlots++;
            } else if (String(existente.maestro_id) !== String(maestroId)) {
                // Había otro maestro y ahora se cambia a este → este maestro gana 1 hora
                nuevosSlots++;
            }
            // Si ya era el mismo maestro, NO sumamos, porque ya está en horasActuales
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

    // ================== SI PASÓ LA VALIDACIÓN, GUARDAR ==================
    const errores = [];

    for (const dia of diasObjetivoBD) {
        try {
            await editarSlotEnServidor(
                grupoId,
                dia,
                horaInicio,
                materiaId,
                maestroId,
                salonId || null
            );
        } catch (err) {
            console.error(`Error al guardar en ${dia}:`, err);
            errores.push(`Día ${dia}: ${err.message}`);
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

    await cargarHorarioSemestre();

    const opt = asegurarGrupoEnSelect(grupoId);
    if (opt) {
        await evaluarCompletitudMateriaGrupo(grupoId, opt);
    }
}



// Elimina TODO el horario de un grupo (todas las horas y días)
// grupoIdParam es opcional: si viene de modo "eliminar grupos" lo pasamos;
// si no, toma el grupo seleccionado en el panel.
async function eliminarHorarioGrupoCompleto(grupoIdParam) {
    let grupoId = grupoIdParam;

    const selGrupo = document.getElementById('selectGrupo');
    if (!grupoId) {
        if (!selGrupo || !selGrupo.value) {
            mostrarAlerta('Selecciona primero un grupo de materia en el panel.', 'warning');
            return;
        }
        grupoId = selGrupo.value;
    }

    if (!confirm('¿Seguro que deseas eliminar TODO el horario de este grupo (todas las horas y días)?')) {
        return;
    }

    const errores = [];

    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
        try {
            const res = await fetch('/api/horarios/liberar-hora', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grupo_id: grupoId,
                    hora_inicio: h
                })
            });

            const data = await res.json();
            if (!res.ok) {
                errores.push(data.mensaje || `Error al liberar la hora ${pad2(h)}:00`);
            }
        } catch (err) {
            console.error('Error al liberar hora', h, err);
            errores.push(`Error al liberar la hora ${pad2(h)}:00`);
        }
    }

    if (errores.length) {
        mostrarAlerta('Se eliminó completamente el horario de este grupo.', 'success');
    }

    await cargarHorarioSemestre();

    const opt2 = asegurarGrupoEnSelect(grupoId);
    if (opt2) {
        await evaluarCompletitudMateriaGrupo(grupoId, opt2);
    }

    // Refrescar la lista de grupos con horario en el modo "eliminar"
    refrescarSelectGruposConHorario();
}

// Elimina SOLO la hora seleccionada (en toda la semana) para ese grupo
async function eliminarBloquePorHora() {
    if (modoPanel !== 'agregar') {
        mostrarAlerta('Para eliminar una hora debes estar en modo "Agregar grupos al horario".', 'warning');
        return;
    }

    const selGrupo = document.getElementById('selectGrupo');
    if (!selGrupo || !selGrupo.value) {
        mostrarAlerta('Selecciona primero un grupo de materia en el panel.', 'warning');
        return;
    }

    // 🔹 Igual que en guardarBloque, usamos la hora seleccionada en la tabla
    const horaStr = document.getElementById('modalHoraInicio').value;
    if (!horaStr) {
        mostrarAlerta('Haz clic en una celda del horario para elegir la hora que quieres eliminar.', 'warning');
        return;
    }

    const horaInicio = parseInt(horaStr, 10);
    if (isNaN(horaInicio)) {
        mostrarAlerta('La hora seleccionada no es válida.', 'danger');
        return;
    }

    if (!confirm('¿Seguro que deseas eliminar esta hora para todo el grupo (en todos los días)?')) {
        return;
    }

    const grupoId = selGrupo.value;

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

        await cargarHorarioSemestre();
        const opt = asegurarGrupoEnSelect(grupoId);
        if (opt) {
            await evaluarCompletitudMateriaGrupo(grupoId, opt);
        }
    } catch (err) {
        console.error('Error al eliminar clase en toda la semana:', err);
        mostrarAlerta('Error al eliminar la clase en toda la semana.', 'danger');
    }
}

// =================== VER HORARIO DEL MAESTRO ===================

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

// =================== VER HORARIO DEL SALÓN ===================

async function verHorarioSalon() {
    const selectSalon = document.getElementById('modalSelectSalon');
    if (!selectSalon) return;

    const salonId = selectSalon.value;
    if (!salonId) {
        mostrarAlerta('Selecciona un salón primero.', 'warning');
        return;
    }

    const textoSalon = selectSalon.options[selectSalon.selectedIndex].textContent;

    try {
        const res = await fetch(`/api/horarios/salon/${salonId}`);
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(
                data.mensaje || 'Error al cargar horario del salón.',
                'danger'
            );
            return;
        }

        const cont = document.getElementById('contenedorHorarioSalon');
        if (!cont) return;

        const mapa = {};
        data.forEach(b => {
            const hora = obtenerHoraDesdeCampo(b.hora_inicio);
            if (hora == null) return;

            const diaNombre = b.dia === 'Miercoles' ? 'Miércoles' : b.dia;
            const key = `${diaNombre}-${hora}`;
            mapa[key] = b;
        });

        let html = `
            <div class="mb-3">
                <strong>Salón ${textoSalon}</strong>
            </div>
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
                    const grupoTag =
                        b.nombre_grupo ? `(${b.nombre_grupo})` :
                        b.grupo ? `(${b.grupo})` : '';

                    html += `
                        <td>
                            <div style="font-size:0.8rem;font-weight:600;">
                                ${b.materia_nombre || b.materia || 'Materia'} ${grupoTag}
                            </div>
                            <div style="font-size:0.7rem;opacity:.8;">
                                ${b.maestro_nombre || b.maestro || 'Maestro'}
                            </div>
                            <div style="font-size:0.7rem;opacity:.8;">${dia}</div>
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
        if (modalHorarioSalon) modalHorarioSalon.show();

    } catch (err) {
        console.error('Error al cargar horario del salón:', err);
        mostrarAlerta('Error al cargar el horario del salón.', 'danger');
    }
}

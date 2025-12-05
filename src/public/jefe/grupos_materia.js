// src/public/jefe/grupos_materia.js

const API_MATERIAS_SEM = '/api/materias/semestre';
const API_GRUPOS_MATERIA = '/api/grupos-materia';

let materiasCache = [];
let modalGrupoMateria = null;
let toastInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ grupos_materia.js cargado');

    const semSel = document.getElementById('selectSemestre');
    const matSel = document.getElementById('selectMateria');
    const btnAgregar = document.getElementById('btnAgregarGrupo');
    const btnVerTodos = document.getElementById('btnVerTodosGrupos');

    modalGrupoMateria = new bootstrap.Modal(
        document.getElementById('modalGrupoMateria')
    );

    // Toast bootstrap
    const toastEl = document.getElementById('appToast');
    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl, { delay: 4000 });
    }

    if (semSel) semSel.addEventListener('change', onSemestreChange);
    if (matSel) matSel.addEventListener('change', onMateriaChange);
    if (btnAgregar) btnAgregar.addEventListener('click', abrirAgregarGrupo);
    if (btnVerTodos) btnVerTodos.addEventListener('click', verTodosGruposSemestre);
});

// ================ UI helpers ================

function mostrarAlerta(msg, tipo = 'info') {
    const toastEl = document.getElementById('appToast');
    const toastBody = document.getElementById('appToastBody');
    if (!toastEl || !toastBody || !bootstrap.Toast) return;

    toastBody.innerHTML = msg;

    let bgClass = 'text-bg-primary';
    if (tipo === 'success') bgClass = 'text-bg-success';
    else if (tipo === 'danger') bgClass = 'text-bg-danger';
    else if (tipo === 'warning') bgClass = 'text-bg-warning text-dark';

    toastEl.className = `toast align-items-center ${bgClass} border-0`;

    if (!toastInstance) {
        toastInstance = new bootstrap.Toast(toastEl, { delay: 4000 });
    }
    toastInstance.show();
}

function limpiarTablaGrupos(mensaje) {
    const tbody = document.getElementById('tbodyGrupos');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-white">
                ${mensaje}
            </td>
        </tr>
    `;
}

function setModoAuto() {
    document.getElementById('tituloModalGrupoMateria').textContent = 'Generar grupos automáticamente';
    const secAuto = document.getElementById('seccionAuto');
    const secEdit = document.getElementById('seccionEditar');
    if (secAuto) secAuto.classList.remove('d-none');
    if (secEdit) secEdit.classList.add('d-none');
}

function setModoEditar() {
    document.getElementById('tituloModalGrupoMateria').textContent = 'Editar grupo';
    const secAuto = document.getElementById('seccionAuto');
    const secEdit = document.getElementById('seccionEditar');
    if (secAuto) secAuto.classList.add('d-none');
    if (secEdit) secEdit.classList.remove('d-none');
}

// ================ Eventos ================

async function onSemestreChange() {
    const semSel = document.getElementById('selectSemestre');
    const matSel = document.getElementById('selectMateria');
    const btnAgregar = document.getElementById('btnAgregarGrupo');
    const btnVerTodos = document.getElementById('btnVerTodosGrupos');

    limpiarTablaGrupos('Selecciona una materia para ver sus grupos.');

    if (!semSel || !matSel || !btnAgregar || !btnVerTodos) return;

    const semestre = semSel.value;
    matSel.innerHTML = '<option value="">Selecciona una materia...</option>';
    matSel.disabled = true;
    btnAgregar.disabled = true;
    btnVerTodos.disabled = true;

    // restaurar título por defecto
    const header = document.querySelector('.card .card-header');
    if (header) header.textContent = 'Grupos de la materia seleccionada';

    if (!semestre) {
        return;
    }

    try {
        const res = await fetch(`${API_MATERIAS_SEM}/${semestre}`);
        if (!res.ok) {
            mostrarAlerta('Error al cargar materias del semestre.', 'danger');
            return;
        }

        const materias = await res.json();
        materiasCache = materias;

        if (!materias.length) {
            matSel.innerHTML =
                '<option value="">No hay materias registradas para este semestre.</option>';
            btnVerTodos.disabled = false; // igual se puede ver "no hay grupos"
            return;
        }

        matSel.disabled = false;
        matSel.innerHTML = '<option value="">Selecciona una materia...</option>';

        materias.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nombre;
            matSel.appendChild(opt);
        });

        // ya hay semestre seleccionado → habilitamos botón
        btnVerTodos.disabled = false;

    } catch (err) {
        console.error('Error al cargar materias:', err);
        mostrarAlerta('Error al cargar materias.', 'danger');
    }
}

async function onMateriaChange() {
    const matSel = document.getElementById('selectMateria');
    const btnAgregar = document.getElementById('btnAgregarGrupo');

    if (!matSel || !btnAgregar) return;

    const materiaId = matSel.value;

    if (!materiaId) {
        limpiarTablaGrupos('Selecciona una materia para ver sus grupos.');
        btnAgregar.disabled = true;
        return;
    }

    // Cambiamos el título para indicar que es por materia
    const header = document.querySelector('.card .card-header');
    if (header) header.textContent = 'Grupos de la materia seleccionada';

    btnAgregar.disabled = false;
    await cargarGruposDeMateria(materiaId);
}

// ================ Ver TODOS los grupos del semestre ================

async function verTodosGruposSemestre() {
    const semSel = document.getElementById('selectSemestre');
    if (!semSel || !semSel.value) {
        mostrarAlerta('Selecciona primero un semestre.', 'warning');
        return;
    }

    const semestre = semSel.value;

    try {
        const res = await fetch(`${API_GRUPOS_MATERIA}/por-semestre/${semestre}`);
        if (!res.ok) {
            mostrarAlerta('Error al cargar los grupos del semestre.', 'danger');
            return;
        }

        const grupos = await res.json();
        const tbody = document.getElementById('tbodyGrupos');
        if (!tbody) return;

        if (!grupos.length) {
            limpiarTablaGrupos(`No hay grupos registrados para el semestre ${semestre}.`);
        } else {
            tbody.innerHTML = '';
            grupos.forEach(g => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${g.id}</td>
                    <td>${g.materia_nombre}</td>
                    <td>${g.nombre_grupo}</td>
                    <td>${g.num_estudiantes}</td>
                    <td>${g.semestre}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-2"
                            onclick="editarGrupoMateria(${g.id}, '${g.nombre_grupo}', ${g.num_estudiantes}, '${g.materia_nombre}')">
                            Editar
                        </button>
                        <button class="btn btn-sm btn-outline-danger"
                            onclick="eliminarGrupoMateria(${g.id})">
                            Eliminar
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // actualizamos título de la tarjeta
        const header = document.querySelector('.card .card-header');
        if (header) header.textContent = `Grupos del semestre ${semestre}`;

    } catch (err) {
        console.error('Error al cargar grupos del semestre:', err);
        mostrarAlerta('Error al cargar los grupos del semestre.', 'danger');
    }
}

// ================ Cargar grupos de una materia ================

async function cargarGruposDeMateria(materiaId) {
    try {
        const res = await fetch(`${API_GRUPOS_MATERIA}?materia_id=${materiaId}`);
        if (!res.ok) {
            mostrarAlerta('Error al cargar grupos de la materia.', 'danger');
            return;
        }

        const grupos = await res.json();
        const tbody = document.getElementById('tbodyGrupos');
        if (!tbody) return;

        if (!grupos.length) {
            limpiarTablaGrupos('Esta materia aún no tiene grupos registrados.');
            return;
        }

        tbody.innerHTML = '';

        grupos.forEach(g => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${g.id}</td>
                <td>${g.materia_nombre}</td>
                <td>${g.nombre_grupo}</td>
                <td>${g.num_estudiantes}</td>
                <td>${g.semestre}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2"
                        onclick="editarGrupoMateria(${g.id}, '${g.nombre_grupo}', ${g.num_estudiantes}, '${g.materia_nombre}')">
                        Editar
                    </button>
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="eliminarGrupoMateria(${g.id})">
                        Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error al cargar grupos de materia:', err);
        mostrarAlerta('Error al cargar los grupos.', 'danger');
    }
}

// ================ Modal Generar / Editar ================

function abrirAgregarGrupo() {
    const matSel = document.getElementById('selectMateria');
    const semSel = document.getElementById('selectSemestre');
    if (!matSel || !semSel) return;

    const materiaId = matSel.value;
    const materiaNombre = matSel.options[matSel.selectedIndex].textContent;
    const semestre = semSel.value;

    if (!materiaId || !semestre) {
        mostrarAlerta('Selecciona semestre y materia primero.', 'warning');
        return;
    }

    document.getElementById('gm_id').value = '';
    document.getElementById('gm_materia_nombre').value = materiaNombre;
    document.getElementById('gm_total_alumnos').value = '';
    document.getElementById('gm_nombre_grupo').value = '';
    document.getElementById('gm_num_estudiantes').value = '';

    setModoAuto();
    modalGrupoMateria.show();
}

function editarGrupoMateria(id, nombreGrupo, numEstudiantes, materiaNombre) {
    document.getElementById('gm_id').value = id;
    document.getElementById('gm_materia_nombre').value = materiaNombre;
    document.getElementById('gm_total_alumnos').value = '';
    document.getElementById('gm_nombre_grupo').value = nombreGrupo;
    document.getElementById('gm_num_estudiantes').value = numEstudiantes;

    setModoEditar();
    modalGrupoMateria.show();
}

// Distribuye N alumnos en grupos de máx. 30 buscando que queden lo más parejos posible.
function calcularGruposDesdeTotal(totalAlumnos) {
    const MAX_POR_GRUPO = 30;
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const numGrupos = Math.ceil(totalAlumnos / MAX_POR_GRUPO);
    const base = Math.floor(totalAlumnos / numGrupos);
    const resto = totalAlumnos % numGrupos;

    const grupos = [];
    for (let i = 0; i < numGrupos; i++) {
        const tam = base + (i < resto ? 1 : 0); // reparte el sobrante
        grupos.push({
            letra: letras[i] || `G${i + 1}`,
            num_estudiantes: tam
        });
    }
    return grupos;
}

async function guardarGrupoMateria() {
    const id = document.getElementById('gm_id').value;
    const matSel = document.getElementById('selectMateria');
    const semSel = document.getElementById('selectSemestre');

    const materiaId = matSel.value;
    const semestre = semSel.value;

    if (!materiaId || !semestre) {
        mostrarAlerta('Selecciona semestre y materia primero.', 'warning');
        return;
    }

    // ====== MODO GENERAR AUTOMÁTICAMENTE (sin id) ======
    if (!id) {
        let totalStr = document.getElementById('gm_total_alumnos').value.trim();
        const total = Number(totalStr);

        if (isNaN(total) || total < 10) {
            mostrarAlerta('Debes indicar al menos 10 alumnos para abrir grupos.', 'warning');
            return;
        }

        const grupos = calcularGruposDesdeTotal(total);
        if (!grupos.length) {
            mostrarAlerta('No se pudieron calcular los grupos.', 'danger');
            return;
        }

        try {
            // 1) Obtener grupos actuales de esa materia/semestre y eliminarlos
            const resExist = await fetch(`${API_GRUPOS_MATERIA}?materia_id=${materiaId}&semestre=${semestre}`);
            if (resExist.ok) {
                const actuales = await resExist.json();
                for (const g of actuales) {
                    await fetch(`${API_GRUPOS_MATERIA}/${g.id}`, { method: 'DELETE' });
                }
            }

            // 2) Crear nuevos grupos
            for (const g of grupos) {
                const datos = {
                    materia_id: Number(materiaId),
                    nombre_grupo: g.letra,
                    num_estudiantes: g.num_estudiantes,
                    semestre: Number(semestre)
                };

                const res = await fetch(API_GRUPOS_MATERIA, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });

                if (!res.ok) {
                    const dataErr = await res.json().catch(() => ({}));
                    throw new Error(dataErr.mensaje || 'Error al crear grupo.');
                }
            }

            mostrarAlerta(
                `Se generaron ${grupos.length} grupo(s) para la materia seleccionada.`,
                'success'
            );
            modalGrupoMateria.hide();
            await cargarGruposDeMateria(materiaId);
        } catch (err) {
            console.error('Error al generar grupos automáticamente:', err);
            mostrarAlerta('Error al generar grupos automáticamente.', 'danger');
        }

        return;
    }

    // ====== MODO EDITAR GRUPO INDIVIDUAL (con id) ======
    let nombreGrupo = document.getElementById('gm_nombre_grupo').value.trim().toUpperCase();
    let numEstudiantes = document.getElementById('gm_num_estudiantes').value.trim();

    if (!nombreGrupo || !numEstudiantes) {
        mostrarAlerta('Completa todos los campos del grupo.', 'warning');
        return;
    }

    numEstudiantes = Number(numEstudiantes);
    if (isNaN(numEstudiantes) || numEstudiantes < 10 || numEstudiantes > 30) {
        mostrarAlerta('El número de estudiantes debe estar entre 10 y 30.', 'warning');
        return;
    }

    const datos = {
        nombre_grupo: nombreGrupo,
        num_estudiantes: numEstudiantes
    };

    try {
        const res = await fetch(`${API_GRUPOS_MATERIA}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al guardar grupo.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Grupo actualizado correctamente.', 'success');
        modalGrupoMateria.hide();
        await cargarGruposDeMateria(materiaId);

    } catch (err) {
        console.error('Error al guardar grupo:', err);
        mostrarAlerta('Error al guardar grupo.', 'danger');
    }
}

// ================ Eliminar grupo ================

async function eliminarGrupoMateria(id) {
    const matSel = document.getElementById('selectMateria');
    const materiaId = matSel ? matSel.value : null;

    if (!confirm('¿Seguro que deseas eliminar este grupo?')) return;

    try {
        const res = await fetch(`${API_GRUPOS_MATERIA}/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al eliminar grupo.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Grupo eliminado correctamente.', 'success');

        if (materiaId) {
            await cargarGruposDeMateria(materiaId);
        }
    } catch (err) {
        console.error('Error al eliminar grupo:', err);
        mostrarAlerta('Error al eliminar grupo.', 'danger');
    }
}

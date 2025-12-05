// src/public/jefe/grupos.js

const API_PLANEACION = '/api/planeacion-semestre';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ jefe/grupos.js cargado');

    const btnCargar = document.getElementById('btnCargarMaterias');
    const btnGuardar = document.getElementById('btnGuardarPlaneacion');
    const btnGenerar = document.getElementById('btnGenerarGrupos');

    if (btnCargar) btnCargar.addEventListener('click', cargarMateriasDelSemestre);
    if (btnGuardar) btnGuardar.addEventListener('click', guardarPlaneacionActual);
    if (btnGenerar) btnGenerar.addEventListener('click', generarGruposPorMateria);
});

function mostrarAlerta(mensaje, tipo = 'danger') {
    const cont = document.getElementById('alert-container');
    if (!cont) return;
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function limpiarGruposGenerados() {
    const tbody = document.getElementById('tbodyGruposGenerados');
    const resumen = document.getElementById('resumenGeneracion');
    if (tbody) tbody.innerHTML = '';
    if (resumen) resumen.textContent = '';
}

// ================== Cargar materias ==================

async function cargarMateriasDelSemestre() {
    limpiarGruposGenerados();

    const selSem = document.getElementById('selectSemestre');
    if (!selSem || !selSem.value) {
        mostrarAlerta('Selecciona primero un semestre.', 'warning');
        return;
    }

    const semestre = selSem.value;

    try {
        const res = await fetch(`${API_PLANEACION}/${semestre}`);
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al cargar materias del semestre.', 'danger');
            return;
        }

        const materias = data;
        const tbody = document.getElementById('tbodyMaterias');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!materias.length) {
            tbody.innerHTML = `
                <tr><td colspan="4" class="text-center text-muted">
                    No hay materias registradas para este semestre.
                </td></tr>`;
            return;
        }

        materias.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.materia_id}</td>
                <td>${m.nombre}</td>
                <td>${m.creditos}</td>
                <td>
                    <input type="number"
                           class="form-control form-control-sm"
                           min="0"
                           step="1"
                           data-materia-id="${m.materia_id}"
                           value="${m.total_alumnos || 0}">
                </td>
            `;
            tbody.appendChild(tr);
        });

        mostrarAlerta('Materias del semestre cargadas.', 'success');

    } catch (err) {
        console.error('❌ Error al cargarMateriasDelSemestre:', err);
        mostrarAlerta('Error al cargar materias del semestre.', 'danger');
    }
}

// ================== Leer planeación desde la tabla ==================

function obtenerPlaneacionDesdeTabla() {
    const tbody = document.getElementById('tbodyMaterias');
    if (!tbody) return [];

    const inputs = tbody.querySelectorAll('input[data-materia-id]');
    const materias = [];

    inputs.forEach(inp => {
        const materiaId = inp.dataset.materiaId;
        const total = parseInt(inp.value, 10) || 0;
        materias.push({
            materia_id: Number(materiaId),
            total_alumnos: total
        });
    });

    return materias;
}

// ================== Guardar planeación ==================

async function guardarPlaneacionActual() {
    const selSem = document.getElementById('selectSemestre');
    if (!selSem || !selSem.value) {
        mostrarAlerta('Selecciona primero un semestre.', 'warning');
        return;
    }
    const semestre = selSem.value;
    const materias = obtenerPlaneacionDesdeTabla();

    try {
        const res = await fetch(`${API_PLANEACION}/${semestre}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materias })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al guardar planeación.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Planeación guardada correctamente.', 'success');
    } catch (err) {
        console.error('❌ Error en guardarPlaneacionActual:', err);
        mostrarAlerta('Error al guardar la planeación.', 'danger');
    }
}

// ================== Generar grupos POR MATERIA ==================

async function generarGruposPorMateria() {
    const selSem = document.getElementById('selectSemestre');
    if (!selSem || !selSem.value) {
        mostrarAlerta('Selecciona primero un semestre.', 'warning');
        return;
    }
    const semestre = selSem.value;
    const materias = obtenerPlaneacionDesdeTabla();

    try {
        const res = await fetch(`${API_PLANEACION}/${semestre}/generar-grupos-materia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materias })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al generar grupos por materia.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Grupos generados correctamente.', 'success');

        const tbody = document.getElementById('tbodyGruposGenerados');
        const resumen = document.getElementById('resumenGeneracion');
        if (tbody) tbody.innerHTML = '';

        let totalGrupos = 0;

        (data.resultados || []).forEach(r => {
            (r.grupos || []).forEach(g => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${g.id}</td>
                    <td>${r.nombre_materia}</td>
                    <td>${g.letra}</td>
                    <td>${g.nombre_grupo}</td>
                    <td>${g.num_estudiantes}</td>
                `;
                tbody.appendChild(tr);
                totalGrupos++;
            });
        });

        if (resumen) {
            resumen.textContent =
                `Se generaron ${totalGrupos} grupos en total para las materias del semestre ${semestre}.`;
        }

    } catch (err) {
        console.error('❌ Error en generarGruposPorMateria:', err);
        mostrarAlerta('Error al generar grupos por materia.', 'danger');
    }
}

// src/public/subdirector/maestros_materias.js

document.addEventListener('DOMContentLoaded', () => {
    cargarMaestros();
    cargarMaterias();
});

async function cargarMaestros() {
    try {
        const res = await fetch('/api/maestros');
        const maestros = await res.json();

        const sel = document.getElementById('selectMaestro');
        sel.innerHTML = '<option value="">Selecciona un maestro...</option>';

        maestros.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nombre;  // viene de tu API /api/maestros
            sel.appendChild(opt);
        });

        sel.addEventListener('change', cargarAsignaciones);
    } catch (err) {
        console.error('Error al cargar maestros:', err);
        mostrarAlerta('Error al cargar la lista de maestros.', 'danger');
    }
}

async function cargarMaterias() {
    try {
        const res = await fetch('/api/materias');
        const materias = await res.json();

        const sel = document.getElementById('selectMateria');
        sel.innerHTML = '<option value="">Selecciona una materia...</option>';

        materias.forEach(mat => {
            const opt = document.createElement('option');
            opt.value = mat.id;
            opt.textContent = `${mat.nombre} (Sem ${mat.semestre}, ${mat.creditos} cr.)`;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Error al cargar materias:', err);
        mostrarAlerta('Error al cargar la lista de materias.', 'danger');
    }
}

async function cargarAsignaciones() {
    const maestroId = document.getElementById('selectMaestro').value;
    const tbody = document.getElementById('tbodyAsignaciones');
    tbody.innerHTML = '';

    if (!maestroId) {
        return;
    }

    try {
        const res = await fetch(`/api/maestros-materias?maestro_id=${maestroId}`);
        const asignaciones = await res.json();

        if (!asignaciones.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.classList.add('text-center');
            td.textContent = 'Este maestro aún no tiene materias asignadas.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        asignaciones.forEach(a => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${a.id}</td>
                <td>${a.nombre_materia}</td>
                <td>${a.creditos}</td>
                <td>${a.semestre}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarAsignacion(${a.id})">
                        Quitar
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar asignaciones:', err);
        mostrarAlerta('Error al cargar las materias asignadas.', 'danger');
    }
}

async function asignarMateria() {
    const maestroId = document.getElementById('selectMaestro').value;
    const materiaId = document.getElementById('selectMateria').value;

    if (!maestroId) {
        mostrarAlerta('Selecciona primero un maestro.', 'warning');
        return;
    }
    if (!materiaId) {
        mostrarAlerta('Selecciona una materia para asignar.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/maestros-materias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                maestro_id: maestroId,
                materia_id: materiaId
            })
        });

        const data = await res.json();
        mostrarAlerta(data.mensaje || 'Operación realizada.', 'success');
        cargarAsignaciones();
    } catch (err) {
        console.error('Error al asignar materia:', err);
        mostrarAlerta('Error al asignar la materia al maestro.', 'danger');
    }
}

async function eliminarAsignacion(id) {
    if (!confirm('¿Seguro que deseas quitar esta materia del maestro?')) return;

    try {
        const res = await fetch(`/api/maestros-materias/${id}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        mostrarAlerta(data.mensaje || 'Asignación eliminada.', 'success');
        cargarAsignaciones();
    } catch (err) {
        console.error('Error al eliminar asignación:', err);
        mostrarAlerta('Error al eliminar la asignación.', 'danger');
    }
}

function mostrarAlerta(mensaje, tipo = 'info') {
    const cont = document.getElementById('alert-container');
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

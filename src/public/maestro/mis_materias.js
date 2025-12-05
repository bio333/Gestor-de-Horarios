// src/public/maestro/mis_materias.js

// ================= OBTENER MAESTRO LOGUEADO DESDE localStorage =================
function obtenerMaestroLogueado() {
    try {
        const raw = localStorage.getItem('usuario');
        if (!raw) return null;

        const obj = JSON.parse(raw);

        // Aceptamos MAESTRO (en mayúsculas o minúsculas)
        if (!obj.rol || obj.rol.toUpperCase() === 'MAESTRO') {
            return obj;
        }

        return null;
    } catch (e) {
        console.error('Error leyendo usuario de localStorage:', e);
        return null;
    }
}

let MAESTRO_LOGUEADO = null;

document.addEventListener('DOMContentLoaded', () => {
    MAESTRO_LOGUEADO = obtenerMaestroLogueado();

    if (!MAESTRO_LOGUEADO) {
        mostrarAlerta(
            'No se encontró la información del maestro logueado. Vuelve a iniciar sesión.',
            'danger'
        );
        return;
    }

    // Cargar catálogo de materias y las materias del maestro
    cargarMaterias();
    cargarMisMaterias();
});

// ================== CARGAR CATÁLOGO DE MATERIAS ==================

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

// ================== CARGAR MATERIAS DEL MAESTRO ==================

async function cargarMisMaterias() {
    const tbody = document.getElementById('tbodyMisMaterias');
    tbody.innerHTML = '';

    if (!MAESTRO_LOGUEADO) {
        mostrarAlerta(
            'No se encontró la información del maestro logueado. Vuelve a iniciar sesión.',
            'danger'
        );
        return;
    }

    const maestroId = MAESTRO_LOGUEADO.id;

    try {
        // 🔹 USAMOS la ruta antigua: /api/maestros-materias?maestro_id=#
        const res = await fetch(`/api/maestros-materias?maestro_id=${maestroId}`);
        const asignaciones = await res.json();

        if (!asignaciones.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.classList.add('text-center');
            td.textContent = 'Aún no has seleccionado materias que puedas impartir.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        asignaciones.forEach(a => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${a.id}</td>
                <td>${a.nombre_materia || a.materia_nombre}</td>
                <td>${a.creditos}</td>
                <td>${a.semestre}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarMiMateria(${a.id})">
                        Quitar
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar mis materias:', err);
        mostrarAlerta('Error al cargar las materias que puedes impartir.', 'danger');
    }
}

// ================== AGREGAR MATERIA AL MAESTRO ==================

async function asignarMateriaMaestro() {
    if (!MAESTRO_LOGUEADO) {
        mostrarAlerta(
            'No se encontró la información del maestro logueado. Vuelve a iniciar sesión.',
            'danger'
        );
        return;
    }

    const materiaId = document.getElementById('selectMateria').value;

    if (!materiaId) {
        mostrarAlerta('Selecciona una materia para agregar.', 'warning');
        return;
    }

    try{
        const maestroId = MAESTRO_LOGUEADO.id;

        // 🔹 POST tradicional: /api/maestros-materias
        const res = await fetch('/api/maestros-materias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                maestro_id: maestroId,
                materia_id: materiaId
            })
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Ocurrió un error al agregar la materia.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Materia agregada correctamente.', 'success');
        cargarMisMaterias();
    } catch (err) {
        console.error('Error al asignar materia (maestro):', err);
        mostrarAlerta('Error al agregar la materia.', 'danger');
    }
}

// ================== ELIMINAR MATERIA DEL MAESTRO ==================

async function eliminarMiMateria(id) {
    if (!confirm('¿Seguro que deseas quitar esta materia de tu lista?')) return;

    try {
        const res = await fetch(`/api/maestros-materias/${id}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Ocurrió un error al quitar la materia.', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje || 'Materia quitada correctamente.', 'success');
        cargarMisMaterias();
    } catch (err) {
        console.error('Error al eliminar materia (maestro):', err);
        mostrarAlerta('Error al quitar la materia.', 'danger');
    }
}

// ================== ALERTAS BOOTSTRAP ==================

function mostrarAlerta(mensaje, tipo = 'info') {
    const cont = document.getElementById('alert-container');
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

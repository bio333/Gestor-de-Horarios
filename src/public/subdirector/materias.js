let modalMateria;
const API = '/api/materias';

document.addEventListener('DOMContentLoaded', () => {
    modalMateria = new bootstrap.Modal(document.getElementById('modalMateria'));
    cargarMaterias();

    const form = document.getElementById('formMateria');
    if (form) {
        form.addEventListener('submit', guardarMateria);
    }
});

function mostrarAlerta(mensaje, tipo = 'success') {
    const cont = document.getElementById('alert-container');
    if (!cont) return; // por si no existe el contenedor
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

async function cargarMaterias() {
    try {
        const res = await fetch(API);
        const materias = await res.json();

        const tbody = document.getElementById('tablaMaterias');
        tbody.innerHTML = '';

        materias.forEach(m => {
            // Para que no reviente si el nombre trae comillas
            const safeNombre = m.nombre.replace(/'/g, "\\'");

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.id}</td>
                <td>${m.nombre}</td>
                <td>${m.creditos}</td>
                <td>${m.semestre}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2"
                        onclick="editarMateria(${m.id}, '${safeNombre}', ${m.creditos}, ${m.semestre})">
                        Editar
                    </button>
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="eliminarMateria(${m.id})">
                        Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error al cargar materias', 'danger');
    }
}

function abrirAgregar() {
    document.getElementById('tituloModal').innerText = 'Agregar materia';
    document.getElementById('materia_id').value = '';
    document.getElementById('nombre').value = '';
    document.getElementById('creditos').value = '';
    document.getElementById('semestre').value = '';
    modalMateria.show();
}

function editarMateria(id, nombre, creditos, semestre) {
    document.getElementById('tituloModal').innerText = 'Editar materia';
    document.getElementById('materia_id').value = id;
    document.getElementById('nombre').value = nombre;
    document.getElementById('creditos').value = String(creditos);
    document.getElementById('semestre').value = String(semestre);
    modalMateria.show();
}

async function guardarMateria(e) {
    if (e) e.preventDefault(); // evita que se recargue la página

    const id = document.getElementById('materia_id').value;
    const nombre = document.getElementById('nombre').value.trim();
    const creditos = parseInt(document.getElementById('creditos').value, 10);
    const semestre = parseInt(document.getElementById('semestre').value, 10);

    if (!nombre || Number.isNaN(creditos) || Number.isNaN(semestre)) {
        mostrarAlerta('Completa todos los campos', 'warning');
        return;
    }

    const body = JSON.stringify({ nombre, creditos, semestre });

    try {
        let res;
        if (id === '') {
            // Crear
            res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        } else {
            // Actualizar
            res = await fetch(`${API}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        }

        const data = await res.json();
        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al guardar materia', 'danger');
            return;
        }

        mostrarAlerta(id === '' ? 'Materia creada correctamente' : 'Materia actualizada correctamente', 'success');
        modalMateria.hide();
        cargarMaterias();
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error de conexión con el servidor', 'danger');
    }
}

async function eliminarMateria(id) {
    if (!confirm('¿Seguro que deseas eliminar esta materia?')) return;

    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al eliminar materia', 'danger');
            return;
        }

        mostrarAlerta('Materia eliminada correctamente', 'success');
        cargarMaterias();
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error de conexión con el servidor', 'danger');
    }
}

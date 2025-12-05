let modalMaestro;

document.addEventListener('DOMContentLoaded', () => {
    modalMaestro = new bootstrap.Modal(document.getElementById('modalMaestro'));
    cargarMaestros();

    document.getElementById('formMaestro').addEventListener('submit', guardarMaestro);
});

function mostrarAlerta(mensaje, tipo = 'success') {
    const cont = document.getElementById('alert-container');
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>
    `;
}

async function cargarMaestros() {
    try {
        const res = await fetch('/api/maestros');
        const maestros = await res.json();

        const tbody = document.querySelector('#tablaMaestros tbody');
        tbody.innerHTML = '';

        maestros.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.id}</td>
                <td>${m.nombre}</td>
                <td>${m.tipo_contrato}</td>
                <td>${m.horas_max_semana}</td>
                <td>${m.horas_asignadas}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2"
                        onclick="editarMaestro(${m.id}, '${m.nombre.replace(/'/g, "\\'")}', '${m.tipo_contrato}')">
                        Editar
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarMaestro(${m.id})">
                        Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error al cargar maestros', 'danger');
    }
}

function abrirModalNuevo() {
    document.getElementById('modalTitulo').textContent = 'Nuevo maestro';
    document.getElementById('maestroId').value = '';
    document.getElementById('maestroNombre').value = '';
    document.getElementById('maestroTipo').value = '';
    document.getElementById('maestroPassword').value = '';
    document.getElementById('textoPasswordAyuda').textContent =
        'Esta será la contraseña inicial del maestro para iniciar sesión.';
}

function editarMaestro(id, nombre, tipo) {
    document.getElementById('modalTitulo').textContent = 'Editar maestro';
    document.getElementById('maestroId').value = id;
    document.getElementById('maestroNombre').value = nombre;
    document.getElementById('maestroTipo').value = tipo;
    document.getElementById('maestroPassword').value = '';
    document.getElementById('textoPasswordAyuda').textContent =
        'Si escribes una nueva contraseña, se actualizará. Deja el campo vacío para no cambiarla.';
    modalMaestro.show();
}

async function guardarMaestro(e) {
    e.preventDefault();

    const id = document.getElementById('maestroId').value;
    const nombre = document.getElementById('maestroNombre').value.trim();
    const tipo_contrato = document.getElementById('maestroTipo').value;
    const password = document.getElementById('maestroPassword').value;

    if (!nombre || !tipo_contrato) {
        mostrarAlerta('Completa todos los campos obligatorios', 'warning');
        return;
    }

    // Para crear, la contraseña es obligatoria
    if (!id && !password) {
        mostrarAlerta('Debes indicar una contraseña inicial para el maestro.', 'warning');
        return;
    }

    const payload = { nombre, tipo_contrato };
    // password solo se envía si viene algo (nuevo o actualización)
    if (password) {
        payload.password = password;
    }

    const body = JSON.stringify(payload);

    try {
        let res;
        if (id) {
            // actualizar
            res = await fetch(`/api/maestros/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        } else {
            // crear
            res = await fetch('/api/maestros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        }

        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al guardar maestro', 'danger');
            return;
        }

        mostrarAlerta(id ? 'Maestro actualizado correctamente' : 'Maestro creado correctamente', 'success');
        modalMaestro.hide();
        cargarMaestros();
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error de conexión con el servidor', 'danger');
    }
}

async function eliminarMaestro(id) {
    if (!confirm('¿Seguro que deseas eliminar este maestro?')) return;

    try {
        const res = await fetch(`/api/maestros/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.mensaje || 'Error al eliminar maestro', 'danger');
            return;
        }

        mostrarAlerta('Maestro eliminado correctamente', 'success');
        cargarMaestros();
    } catch (err) {
        console.error(err);
        mostrarAlerta('Error de conexión con el servidor', 'danger');
    }
}

function logout() {
    window.location.href = '/login/index.html';
}

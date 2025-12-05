// src/public/subdirector/salones.js
const API_SALONES = '/api/salones';

// Mapeo simple de edificio_id → nombre
const EDIFICIOS_MAP = {
    1: 'R1',
    2: 'R2',
    3: 'P'
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ salones.js cargado');
    cargarSalones();
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

async function cargarSalones() {
    try {
        console.log('🔄 Cargando salones desde', API_SALONES);
        const res = await fetch(API_SALONES);

        if (!res.ok) {
            mostrarAlerta('Error al cargar salones (HTTP ' + res.status + ')', 'danger');
            return;
        }

        const salones = await res.json();
        console.log('📦 Salones recibidos:', salones);

        const tbody = document.getElementById('tablaSalones');
        tbody.innerHTML = '';

        salones.forEach(salon => {
            const edificioNombre = EDIFICIOS_MAP[salon.edificio_id] || salon.edificio_id;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${salon.id}</td>
                <td>${edificioNombre}</td>
                <td>${salon.clave}</td>
                <td>${salon.capacidad}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('❌ Error en cargarSalones:', err);
        mostrarAlerta('Error al cargar salones.', 'danger');
    }
}

// src/public/jefe/horarios_auto.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ horarios_auto.js (jefe) cargado');

    const btn = document.getElementById('btnGenerar');
    btn.addEventListener('click', generarHorarios);
});

function mostrarAlerta(mensaje, tipo = 'info') {
    const cont = document.getElementById('alert-container');
    if (!cont) return;
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

async function generarHorarios() {
    const btn = document.getElementById('btnGenerar');
    btn.disabled = true;
    btn.textContent = 'Generando...';

    mostrarAlerta('Iniciando generación de horarios. Por favor espera...', 'warning');

    try {
        const res = await fetch('/api/horarios/generar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error('❌ Error HTTP en generar:', res.status, txt);
            mostrarAlerta('Error al generar horarios (HTTP ' + res.status + ').', 'danger');
        } else {
            const data = await res.json().catch(() => ({}));
            console.log('✅ Respuesta generar:', data);
            mostrarAlerta(data.mensaje || 'Horarios generados correctamente.', 'success');
        }
    } catch (err) {
        console.error('❌ Error en generarHorarios:', err);
        mostrarAlerta('Error al generar horarios.', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generar horario ahora';
    }
}

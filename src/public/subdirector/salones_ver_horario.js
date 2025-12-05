// src/public/subdirector/salones_ver_horario.js

const API_HORARIO_SALON = '/api/horarios/salon';

// Horas de tu horario (ajusta si usas otras)
const HOURS_SALON = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00'
];

const DAYS_SALON = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes'
};

const DAYS_ARRAY_SALON = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ salones_ver_horario.js (subdirector) cargado');

    const btnVerHorarioSalon = document.getElementById('btnVerHorarioSalon');
    if (!btnVerHorarioSalon) return;

    btnVerHorarioSalon.addEventListener('click', () => {
        // ⬇️ AHORA usamos el select correcto del HTML
        const selectSalon = document.getElementById('selectSalon');
        if (!selectSalon) {
            console.error('No se encontró el select de salón (selectSalon)');
            return;
        }

        const salonId = selectSalon.value;
        if (!salonId) {
            mostrarAlertaSubdirector('Selecciona un salón primero.', 'warning');
            return;
        }

        const textoSalon = selectSalon.options[selectSalon.selectedIndex].textContent;
        cargarHorarioSalonSubdirector(salonId, textoSalon);
    });
});

function mostrarAlertaSubdirector(mensaje, tipo = 'danger') {
    const cont = document.getElementById('alert-container');
    if (!cont) return;
    cont.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

async function cargarHorarioSalonSubdirector(salonId, textoSalon) {
    try {
        console.log(`🔄 [Subdirector] Cargando horario del salón ${salonId}`);
        const res = await fetch(`${API_HORARIO_SALON}/${salonId}`);
        if (!res.ok) {
            mostrarAlertaSubdirector('Error al cargar horario (HTTP ' + res.status + ')', 'danger');
            return;
        }

        const data = await res.json();
        console.log('📦 [Subdirector] Horario salón:', data);

        // horario[hora][diaNombre] = contenido
        const horario = {};
        HOURS_SALON.forEach(h => {
            horario[h] = {};
            DAYS_ARRAY_SALON.forEach(d => {
                horario[h][d] = '';
            });
        });

        data.forEach(item => {
            let diaNombre;
            if (typeof item.dia === 'number') {
                diaNombre = DAYS_SALON[item.dia];
            } else {
                diaNombre = item.dia;
            }

            const horaInicio = (item.hora_inicio || '').slice(0, 5);

            if (!HOURS_SALON.includes(horaInicio) || !DAYS_ARRAY_SALON.includes(diaNombre)) {
                return; // fuera del rango de la tabla
            }

            const textoCelda = `
                <strong>${item.materia || ''}</strong><br>
                ${item.maestro || ''}<br>
                <span class="text-info">${item.grupo ? ('Grupo: ' + item.grupo) : ''}</span>
            `;

            if (horario[horaInicio][diaNombre]) {
                horario[horaInicio][diaNombre] += '<hr class="my-1">' + textoCelda;
            } else {
                horario[horaInicio][diaNombre] = textoCelda;
            }
        });

                const tbody = document.getElementById('tbodyHorarioSalonSubdirector');
        if (!tbody) return;
        tbody.innerHTML = '';

        HOURS_SALON.forEach(hora => {
            const tr = document.createElement('tr');

            const tdHora = document.createElement('td');

            // Mostrar como rango: 07:00 - 08:00, ..., 14:00 - 15:00
            const hInt = parseInt(hora.slice(0, 2), 10);
            const siguiente = hInt + 1;
            const siguienteStr = siguiente.toString().padStart(2, '0') + ':00';

            tdHora.textContent = `${hora} - ${siguienteStr}`;
            tr.appendChild(tdHora);

            DAYS_ARRAY_SALON.forEach(dia => {
                const td = document.createElement('td');
                const contenido = horario[hora][dia];

                if (contenido) {
                    td.innerHTML = contenido;
                    td.classList.add('celda-ocupada');
                } else {
                    td.innerHTML = ''; // libre
                    td.classList.add('celda-libre');
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });



        if (data.length === 0) {
            mostrarAlertaSubdirector('Este salón no tiene clases asignadas en el horario.', 'info');
        } else {
            mostrarAlertaSubdirector('Horario del salón cargado correctamente.', 'success');
        }

        // Título del modal con el nombre del salón
        const tituloModal = document.getElementById('modalHorarioSalonSubdirectorLabel');
        if (tituloModal) {
            tituloModal.textContent = `Horario del salón ${textoSalon}`;
        }

        // Mostrar modal
        const modalEl = document.getElementById('modalHorarioSalonSubdirector');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }

    } catch (err) {
        console.error('❌ Error en cargarHorarioSalonSubdirector:', err);
        mostrarAlertaSubdirector('Error al cargar el horario del salón.', 'danger');
    }
}

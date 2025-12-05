// src/public/jefe/salones_horario.js

const API_SALONES = '/api/salones';
const API_HORARIO_SALON = '/api/horarios/salon';

// Horas (inicio de cada bloque)
const HOURS = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00' // 👉 esto muestra 07-08 ... 14-15 (termina a las 15:00)
];

// Mapeo de día numérico (1–5) a nombre
const DAYS = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes'
};

// Para dibujar en columnas fijas
const DAYS_ARRAY = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ salones_horario.js (jefe) cargado');

    cargarSalones();

    const btnVerHorario = document.getElementById('btnVerHorario');
    if (btnVerHorario) {
        btnVerHorario.addEventListener('click', () => {
            const selectSalon = document.getElementById('selectSalon');
            if (!selectSalon) return;

            const salonId = selectSalon.value;
            if (!salonId) {
                mostrarAlerta('Selecciona un salón primero.', 'warning');
                return;
            }

            const textoSalon = selectSalon.options[selectSalon.selectedIndex].textContent;
            cargarHorarioSalon(salonId, textoSalon);
        });
    }
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
        const res = await fetch(API_SALONES);
        if (!res.ok) {
            mostrarAlerta('Error al cargar salones (HTTP ' + res.status + ')', 'danger');
            return;
        }

        const salones = await res.json();
        console.log('📦 Salones (jefe):', salones);

        const select = document.getElementById('selectSalon');
        if (!select) return;

        select.innerHTML = '<option value="">Selecciona un salón...</option>';

        salones.forEach(s => {
            const texto = `${s.clave || ('Salón ' + s.id)}`;
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = texto;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('❌ Error en cargarSalones (jefe):', err);
        mostrarAlerta('Error al cargar salones.', 'danger');
    }
}

async function cargarHorarioSalon(salonId, textoSalon) {
    try {
        console.log(`🔄 [Jefe] Cargando horario del salón ${salonId}`);
        const res = await fetch(`${API_HORARIO_SALON}/${salonId}`);
        if (!res.ok) {
            mostrarAlerta('Error al cargar horario (HTTP ' + res.status + ')', 'danger');
            return;
        }

        const data = await res.json();
        console.log('📦 [Jefe] Horario salón:', data);

        // Construimos estructura: horario[hora][diaNombre] = texto
        const horario = {};
        HOURS.forEach(h => {
            horario[h] = {};
            DAYS_ARRAY.forEach(d => {
                horario[h][d] = '';
            });
        });

        // Rellenar con datos reales
        data.forEach(item => {
            let diaNombre;
            if (typeof item.dia === 'number') {
                diaNombre = DAYS[item.dia];
            } else {
                // Manejar 'Miercoles' (sin acento) que viene de la BD
                diaNombre = (item.dia === 'Miercoles') ? 'Miércoles' : item.dia;
            }

            const horaInicio = (item.hora_inicio || '').slice(0, 5); // 'HH:MM'

            // Fuera de rango → ignorar
            if (!HOURS.includes(horaInicio) || !DAYS_ARRAY.includes(diaNombre)) {
                return;
            }

            const textoCelda = `
                <strong>${item.materia || ''}</strong><br>
                ${item.maestro || ''}<br>
                <span class="text-info">
                    ${item.grupo ? ('Grupo: ' + item.grupo) : ''}
                </span>
            `;

            if (horario[horaInicio][diaNombre]) {
                horario[horaInicio][diaNombre] += '<hr class="my-1">' + textoCelda;
            } else {
                horario[horaInicio][diaNombre] = textoCelda;
            }
        });

        // Dibujar tabla
        const tbody = document.getElementById('tbodyHorario');
        if (!tbody) return;
        tbody.innerHTML = '';

        HOURS.forEach(hora => {
            const tr = document.createElement('tr');

            // Columna de la hora: 07:00 - 08:00, ..., 14:00 - 15:00
            const tdHora = document.createElement('td');
            const hInt = parseInt(hora.slice(0, 2), 10);
            const siguiente = hInt + 1;
            const siguienteStr = siguiente.toString().padStart(2, '0') + ':00';
            tdHora.textContent = `${hora} - ${siguienteStr}`;
            tr.appendChild(tdHora);

            // Columnas de días
            DAYS_ARRAY.forEach(dia => {
                const td = document.createElement('td');
                const contenido = horario[hora][dia];

                if (contenido) {
                    td.innerHTML = contenido;
                    td.classList.add('celda-ocupada');
                } else {
                    td.innerHTML = '';
                    td.classList.add('celda-libre');
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        if (data.length === 0) {
            mostrarAlerta('Este salón no tiene clases asignadas en el horario.', 'info');
        } else {
            mostrarAlerta('Horario del salón cargado correctamente.', 'success');
        }

        // Actualizar título con el nombre del salón
        const tituloSalon = document.getElementById('tituloSalonSeleccionado');
        if (tituloSalon) {
            tituloSalon.textContent = textoSalon ? ` ${textoSalon}` : '';
        }

    } catch (err) {
        console.error('❌ Error en cargarHorarioSalon (jefe):', err);
        mostrarAlerta('Error al cargar el horario del salón.', 'danger');
    }
}

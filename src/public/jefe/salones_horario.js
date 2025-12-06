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

// Para el PDF
let salonSeleccionadoId = null;
let salonSeleccionadoNombre = '';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ salones_horario.js (jefe) cargado');

    cargarSalones();

    // Cuando cambie el salón, se carga automáticamente el horario
    const selectSalon = document.getElementById('selectSalon');
    if (selectSalon) {
        selectSalon.addEventListener('change', () => {
            const salonId = selectSalon.value;
            const textoSalon =
                selectSalon.options[selectSalon.selectedIndex]?.textContent || '';

            if (salonId) {
                cargarHorarioSalon(salonId, textoSalon);
            } else {
                limpiarHorarioSalon();
            }
        });
    }

    // Botón para descargar PDF
    const btnDescargarPdf = document.getElementById('btnDescargarPdfSalon');
    if (btnDescargarPdf) {
        btnDescargarPdf.addEventListener('click', generarPdfHorarioSalon);
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

function limpiarHorarioSalon() {
    // Limpia la tabla y el título
    const tbody = document.getElementById('tbodyHorario');
    if (tbody) tbody.innerHTML = '';

    const tituloSalon = document.getElementById('tituloSalonSeleccionado');
    if (tituloSalon) tituloSalon.textContent = '';

    salonSeleccionadoId = null;
    salonSeleccionadoNombre = '';
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

        // Guardar para el PDF
        salonSeleccionadoId = salonId;
        salonSeleccionadoNombre = textoSalon || '';

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

/* =============== PDF HORARIO POR SALÓN =============== */

function generarPdfHorarioSalon() {
    // Debe haber un salón seleccionado
    if (!salonSeleccionadoId) {
        mostrarAlerta('Selecciona un salón antes de descargar el PDF.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || typeof jsPDF !== 'function') {
        mostrarAlerta('Error: jsPDF no está disponible.', 'danger');
        return;
    }

    // Intentar encontrar la tabla por ID
    let tabla = document.getElementById('tablaHorarioSalon');

    // Fallback: si por alguna razón no la encuentra por ID,
    // toma la primera tabla dentro del card del horario.
    if (!tabla) {
        tabla = document.querySelector('.card table.table');
    }

    console.log('🧪 Tabla para PDF:', tabla);

    if (!tabla) {
        mostrarAlerta('No se encontró la tabla del horario del salón.', 'danger');
        return;
    }

    const doc = new jsPDF();

    // Título
    doc.setFontSize(14);
    doc.text('Gestor de Horarios - Horario por salón', 14, 15);
    doc.setFontSize(12);
    doc.text(`Salón: ${salonSeleccionadoNombre}`, 14, 22);

    // Encabezados
    const head = [];
    const ths = tabla.querySelectorAll('thead th');
    const headRow = [];
    ths.forEach(th => headRow.push(th.innerText.trim()));
    head.push(headRow);

    // Cuerpo
    const body = [];
    const tbody = document.getElementById('tbodyHorario');
    if (tbody) {
        Array.from(tbody.rows).forEach(tr => {
            const rowData = [];
            Array.from(tr.cells).forEach(td => {
                const text = td.innerText
                    .replace(/\s*\n\s*/g, '\n') // compactar saltos
                    .trim();
                rowData.push(text);
            });
            body.push(rowData);
        });
    }

    if (typeof doc.autoTable !== 'function') {
        mostrarAlerta('No se encontró el plugin autoTable de jsPDF.', 'danger');
        return;
    }

    doc.autoTable({
        head,
        body,
        startY: 28,
        styles: {
            fontSize: 8,
            valign: 'top'
        },
        headStyles: { fillColor: [0, 104, 150] }
    });

    const nombreArchivo = `Horario_Salon_${salonSeleccionadoNombre || salonSeleccionadoId}.pdf`;
    doc.save(nombreArchivo);

    mostrarAlerta('Horario del salón descargado en PDF.', 'success');
}

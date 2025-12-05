// src/models/Maestro.js
const { query } = require('../config/db');

// La tabla real en tu BD es "docentes"
const TABLA_MAESTROS = 'docentes';

function calcularHorasPorTipo(tipo) {
    if (tipo === 'T') return 22;   // Tiempo completo
    if (tipo === 'MT') return 18;  // Medio tiempo
    if (tipo === 'CM') return 12;  // Carga mínima
    return 0;
}

module.exports = {
    // Obtener todos los maestros
    async obtenerTodos() {
        const sql = `SELECT * FROM ${TABLA_MAESTROS}`;
        const rows = await query(sql);
        return rows;
    },

    // Obtener maestro por id
    async obtenerPorId(id) {
        const sql = `SELECT * FROM ${TABLA_MAESTROS} WHERE id = ?`;
        const rows = await query(sql, [id]);
        return rows[0] || null;
    },

    // Crear maestro (solo en tabla docentes)
    async crear(datos) {
        const horas = datos.horas_max_semana != null
            ? datos.horas_max_semana
            : calcularHorasPorTipo(datos.tipo_contrato);

        const sql = `
            INSERT INTO ${TABLA_MAESTROS}
            (nombre, tipo_contrato, horas_max_semana, horas_asignadas)
            VALUES (?, ?, ?, 0)
        `;
        const params = [
            datos.nombre,
            datos.tipo_contrato,
            horas
        ];
        const result = await query(sql, params);

        return {
            id: result.insertId,
            nombre: datos.nombre,
            tipo_contrato: datos.tipo_contrato,
            horas_max_semana: horas,
            horas_asignadas: 0
        };
    },

    // Actualizar maestro
    async actualizar(id, datos) {
        const horas = datos.horas_max_semana != null
            ? datos.horas_max_semana
            : calcularHorasPorTipo(datos.tipo_contrato);

        const sql = `
            UPDATE ${TABLA_MAESTROS}
            SET nombre = ?, tipo_contrato = ?, horas_max_semana = ?
            WHERE id = ?
        `;
        const params = [
            datos.nombre,
            datos.tipo_contrato,
            horas,
            id
        ];
        await query(sql, params);

        return {
            id,
            nombre: datos.nombre,
            tipo_contrato: datos.tipo_contrato,
            horas_max_semana: horas
        };
    },

    // Eliminar maestro
    async eliminar(id) {
        const sql = `DELETE FROM ${TABLA_MAESTROS} WHERE id = ?`;
        await query(sql, [id]);
        return true;
    }
};

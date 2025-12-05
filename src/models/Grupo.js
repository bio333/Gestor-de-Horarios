// src/models/Grupo.js
const { query } = require('../config/db');

const TABLA_GRUPOS = 'grupos';

module.exports = {
    // Obtener todos los grupos
    async obtenerTodos() {
        const sql = `SELECT * FROM ${TABLA_GRUPOS}`;
        const rows = await query(sql);
        return rows;
    },

    // Obtener grupo por ID
    async obtenerPorId(id) {
        const sql = `SELECT * FROM ${TABLA_GRUPOS} WHERE id = ?`;
        const rows = await query(sql, [id]);
        return rows[0] || null;
    },

    // Crear grupo
    async crear(datos) {
        const sql = `
            INSERT INTO ${TABLA_GRUPOS}
            (semestre, grupo, num_estudiantes, salon_id)
            VALUES (?, ?, ?, ?)
        `;
        const params = [
            datos.semestre,
            datos.grupo,
            datos.num_estudiantes || 0,
            datos.salon_id || null
        ];
        const result = await query(sql, params);
        return { id: result.insertId, ...datos };
    },

    // Actualizar grupo
    async actualizar(id, datos) {
        const sql = `
            UPDATE ${TABLA_GRUPOS}
            SET semestre = ?, grupo = ?, num_estudiantes = ?, salon_id = ?
            WHERE id = ?
        `;
        const params = [
            datos.semestre,
            datos.grupo,
            datos.num_estudiantes || 0,
            datos.salon_id || null,
            id
        ];
        await query(sql, params);
        return { id, ...datos };
    },

    // Eliminar grupo
    async eliminar(id) {
        const sql = `DELETE FROM ${TABLA_GRUPOS} WHERE id = ?`;
        await query(sql, [id]);
        return true;
    }
};

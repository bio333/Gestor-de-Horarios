// src/models/Materia.js
const { query } = require('../config/db');

const TABLA_MATERIAS = 'materias';

module.exports = {
    // Obtener todas las materias
    async obtenerTodas() {
        const sql = `SELECT * FROM ${TABLA_MATERIAS}`;
        const rows = await query(sql);
        return rows;
    },

    // Obtener materia por ID
    async obtenerPorId(id) {
        const sql = `SELECT * FROM ${TABLA_MATERIAS} WHERE id = ?`;
        const rows = await query(sql, [id]);
        return rows[0] || null;
    },

    // Crear materia
    async crear(datos) {
        const sql = `
            INSERT INTO ${TABLA_MATERIAS}
            (nombre, creditos, semestre)
            VALUES (?, ?, ?)
        `;
        const params = [
            datos.nombre,
            datos.creditos,
            datos.semestre
        ];
        const result = await query(sql, params);
        return { id: result.insertId, ...datos };
    },

    // Actualizar materia
    async actualizar(id, datos) {
        const sql = `
            UPDATE ${TABLA_MATERIAS}
            SET nombre = ?, creditos = ?, semestre = ?
            WHERE id = ?
        `;
        const params = [
            datos.nombre,
            datos.creditos,
            datos.semestre,
            id
        ];
        await query(sql, params);
        return { id, ...datos };
    },

    // Eliminar materia
    async eliminar(id) {
        const sql = `DELETE FROM ${TABLA_MATERIAS} WHERE id = ?`;
        await query(sql, [id]);
        return true;
    }
};

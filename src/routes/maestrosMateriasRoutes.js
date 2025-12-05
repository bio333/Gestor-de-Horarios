// src/routes/maestrosMateriasRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');  // helper con Promises

console.log('✅ maestrosMateriasRoutes cargado');

/* ============================================================
   HELPERS: info y horario de maestros
   ============================================================ */

async function obtenerInfoMaestro(maestroId) {
    const rows = await query(
        `
        SELECT 
            d.id,
            d.nombre,
            d.tipo_contrato,
            d.horas_max_semana,
            (
                SELECT COUNT(*) 
                FROM horarios h 
                WHERE h.maestro_id = d.id
            ) AS horas_asignadas
        FROM docentes d
        WHERE d.id = ?
        `,
        [maestroId]
    );

    if (!rows.length) {
        throw new Error('Maestro no encontrado');
    }

    return rows[0];
}


async function obtenerHorarioMaestro(maestroId) {
    const rows = await query(
        `SELECT
            h.id,
            h.dia,
            h.hora_inicio,
            h.hora_fin,
            h.tipo,
            h.grupo_id,
            h.materia_id,
            h.maestro_id,
            h.salon_id,
            g.grupo           AS nombre_grupo,
            m.nombre          AS materia_nombre,
            s.clave           AS salon_clave,
            d.nombre          AS maestro_nombre
         FROM horarios h
         LEFT JOIN grupos   g ON g.id = h.grupo_id
         LEFT JOIN materias m ON m.id = h.materia_id
         LEFT JOIN salones  s ON s.id = h.salon_id
         LEFT JOIN docentes d ON d.id = h.maestro_id
         WHERE h.maestro_id = ?
         ORDER BY FIELD(h.dia,'Lunes','Martes','Miercoles','Jueves','Viernes'),
                  h.hora_inicio`,
        [maestroId]
    );
    return rows;
}

/* ============================================================
   RUTAS MAESTRO <-> MATERIA  (/api/maestros-materias...)
   ============================================================ */

/**
 * GET /api/maestros-materias?maestro_id=#
 * Devuelve las materias que puede impartir un maestro.
 */
router.get('/maestros-materias', async (req, res) => {
    try {
        const maestroId = parseInt(req.query.maestro_id, 10);

        if (!maestroId) {
            return res.status(400).json({ mensaje: 'maestro_id es obligatorio' });
        }

        const rows = await query(
            `SELECT 
                 mm.id,
                 mm.maestro_id,
                 mm.materia_id,
                 m.nombre   AS nombre_materia,
                 m.creditos,
                 m.semestre
             FROM maestros_materias mm
             JOIN materias m ON m.id = mm.materia_id
             WHERE mm.maestro_id = ?`,
            [maestroId]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/maestros-materias:', err);
        res.status(500).json({
            mensaje: 'Error al obtener materias del maestro',
            error: err.message
        });
    }
});

/**
 * POST /api/maestros-materias
 * body: { maestro_id, materia_id }
 */
router.post('/maestros-materias', async (req, res) => {
    try {
        const { maestro_id, materia_id } = req.body;

        if (!maestro_id || !materia_id) {
            return res.status(400).json({ mensaje: 'maestro_id y materia_id son obligatorios' });
        }

        // Evitar duplicados
        const existe = await query(
            `SELECT id 
             FROM maestros_materias
             WHERE maestro_id = ? AND materia_id = ?`,
            [maestro_id, materia_id]
        );

        if (existe.length) {
            return res.status(400).json({ mensaje: 'Esta materia ya está en tu lista.' });
        }

        const result = await query(
            `INSERT INTO maestros_materias (maestro_id, materia_id)
             VALUES (?, ?)`,
            [maestro_id, materia_id]
        );

        res.status(201).json({
            id: result.insertId,
            maestro_id,
            materia_id,
            mensaje: 'Materia agregada correctamente.'
        });
    } catch (err) {
        console.error('❌ Error en POST /api/maestros-materias:', err);
        res.status(500).json({
            mensaje: 'Error al agregar materia al maestro',
            error: err.message
        });
    }
});

/**
 * DELETE /api/maestros-materias/:id
 * Elimina la relación maestro–materia
 */
router.delete('/maestros-materias/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) {
            return res.status(400).json({ mensaje: 'id inválido' });
        }

        await query(
            `DELETE FROM maestros_materias
             WHERE id = ?`,
            [id]
        );

        res.json({ mensaje: 'Materia quitada correctamente.' });
    } catch (err) {
        console.error('❌ Error en DELETE /api/maestros-materias/:id:', err);
        res.status(500).json({
            mensaje: 'Error al quitar materia del maestro',
            error: err.message
        });
    }
});

/**
 * GET /api/maestros-materias/por-materia/:materiaId
 * Devuelve los maestros que pueden impartir una materia.
 * (Usado por el JEFE en horarios_materia.js)
 */
router.get('/maestros-materias/por-materia/:materiaId', async (req, res) => {
    try {
        const materiaId = parseInt(req.params.materiaId, 10);
        if (isNaN(materiaId)) {
            return res.status(400).json({ mensaje: 'materiaId inválido' });
        }

        const rows = await query(
            `SELECT 
                 d.id,
                 d.nombre,
                 d.tipo_contrato,
                 d.horas_max_semana,
                 d.horas_asignadas
             FROM maestros_materias mm
             JOIN docentes d ON d.id = mm.maestro_id
             WHERE mm.materia_id = ?`,
            [materiaId]
        );

        res.json(rows);  // 👈 el JS del jefe espera [{id, nombre, ...}]
    } catch (err) {
        console.error('❌ Error en GET /api/maestros-materias/por-materia/:materiaId:', err);
        res.status(500).json({
            mensaje: 'Error al obtener maestros para la materia',
            error: err.message
        });
    }
});


module.exports = router;

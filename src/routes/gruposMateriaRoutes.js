// src/routes/gruposMateriaRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

console.log('✅ gruposMateriaRoutes cargado');

/**
 * GET /api/grupos-materia
 * Opciones:
 *   - ?materia_id=#
 *   - ?semestre=#
 *   - ambos al mismo tiempo
 */
router.get('/', async (req, res) => {
    try {
        const { materia_id, semestre } = req.query;

        let sql = `
            SELECT 
                gm.id,
                gm.materia_id,
                m.nombre      AS materia_nombre,
                m.creditos    AS materia_creditos,
                gm.nombre_grupo,
                gm.num_estudiantes,
                gm.semestre
            FROM grupos_materia gm
            JOIN materias m ON m.id = gm.materia_id
            WHERE 1=1
        `;
        const params = [];

        if (materia_id) {
            sql += ' AND gm.materia_id = ?';
            params.push(materia_id);
        }

        if (semestre) {
            sql += ' AND gm.semestre = ?';
            params.push(parseInt(semestre, 10));
        }

        sql += ' ORDER BY m.nombre, gm.nombre_grupo';

        const rows = await query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/grupos-materia:', err);
        res.status(500).json({ mensaje: 'Error al obtener grupos de la materia' });
    }
});

/**
 * POST /api/grupos-materia
 * Body esperado:
 *   { materia_id, nombre_grupo, num_estudiantes, semestre }
 */
router.post('/', async (req, res) => {
    try {
        const { materia_id, nombre_grupo, num_estudiantes, semestre } = req.body;

        if (!materia_id || !nombre_grupo || !num_estudiantes || !semestre) {
            return res.status(400).json({ mensaje: 'Datos incompletos.' });
        }

        // Insertar el nuevo grupo
        const result = await query(
            `INSERT INTO grupos_materia (materia_id, nombre_grupo, num_estudiantes, semestre)
             VALUES (?, ?, ?, ?)`,
            [materia_id, nombre_grupo, num_estudiantes, semestre]
        );

        const nuevo = {
            id: result.insertId,
            materia_id,
            nombre_grupo,
            num_estudiantes,
            semestre
        };

        res.status(201).json({
            mensaje: 'Grupo creado correctamente.',
            grupo: nuevo
        });
    } catch (err) {
        console.error('❌ Error en POST /api/grupos-materia:', err);
        res.status(500).json({ mensaje: 'Error al guardar grupo.' });
    }
});

/**
 * PUT /api/grupos-materia/:id  (editar grupo)
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_grupo, num_estudiantes } = req.body;

        if (!nombre_grupo || !num_estudiantes) {
            return res.status(400).json({ mensaje: 'Datos incompletos.' });
        }

        await query(
            `UPDATE grupos_materia
             SET nombre_grupo = ?, num_estudiantes = ?
             WHERE id = ?`,
            [nombre_grupo, num_estudiantes, id]
        );

        res.json({ mensaje: 'Grupo actualizado correctamente.' });
    } catch (err) {
        console.error('❌ Error en PUT /api/grupos-materia/:id:', err);
        res.status(500).json({ mensaje: 'Error al actualizar grupo.' });
    }
});

/**
 * DELETE /api/grupos-materia/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM grupos_materia WHERE id = ?', [id]);

        res.json({ mensaje: 'Grupo eliminado correctamente.' });
    } catch (err) {
        console.error('❌ Error en DELETE /api/grupos-materia/:id:', err);
        res.status(500).json({ mensaje: 'Error al eliminar grupo.' });
    }
});

// GET /api/grupos-materia/por-semestre/:semestre
// Devuelve TODOS los grupos_materia de ese semestre
router.get('/por-semestre/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre)) {
            return res.status(400).json({ mensaje: 'semestre inválido' });
        }

        const rows = await query(
            `SELECT gm.*,
                    m.nombre AS materia_nombre
             FROM grupos_materia gm
             LEFT JOIN materias m ON m.id = gm.materia_id
             WHERE gm.semestre = ?
             ORDER BY m.nombre, gm.nombre_grupo`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/grupos-materia/por-semestre/:semestre:', err);
        res.status(500).json({
            mensaje: 'Error al obtener grupos del semestre',
            error: err.message
        });
    }
});


module.exports = router;

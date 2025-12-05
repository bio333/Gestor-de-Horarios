// src/routes/planeacionSemestreRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

/* ======================== GET: materias de un semestre ======================== */
/**
 * GET /api/planeacion-semestre/:semestre
 * Devuelve materias del semestre + total_alumnos (si ya hay planeación).
 */
router.get('/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre) || semestre < 1 || semestre > 9) {
            return res.status(400).json({ mensaje: 'Semestre inválido (1–9).' });
        }

        const rows = await query(
            `SELECT 
                 m.id        AS materia_id,
                 m.nombre    AS nombre,
                 m.creditos,
                 IFNULL(p.total_alumnos, 0) AS total_alumnos
             FROM materias m
             LEFT JOIN planeacion_materias_semestre p
               ON p.materia_id = m.id AND p.semestre = m.semestre
             WHERE m.semestre = ?
             ORDER BY m.nombre`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/planeacion-semestre/:semestre:', err);
        res.status(500).json({ mensaje: 'Error al obtener planeación.', error: err.message });
    }
});

/* ======================== POST: guardar planeación ======================== */
/**
 * POST /api/planeacion-semestre/:semestre
 * Body: { materias: [ { materia_id, total_alumnos }, ... ] }
 */
router.post('/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre) || semestre < 1 || semestre > 9) {
            return res.status(400).json({ mensaje: 'Semestre inválido (1–9).' });
        }

        const materias = Array.isArray(req.body.materias) ? req.body.materias : [];

        for (const m of materias) {
            const total = parseInt(m.total_alumnos, 10) || 0;
            if (total < 0) {
                return res.status(400).json({
                    mensaje: 'total_alumnos no puede ser negativo.'
                });
            }
            // Si la materia se va a ofrecer, que tenga al menos 10 alumnos
            if (total > 0 && total < 10) {
                return res.status(400).json({
                    mensaje: `La materia ${m.materia_id} tiene menos de 10 alumnos (${total}).`
                });
            }
        }

        // UPSERT por materia
        for (const m of materias) {
            const materiaId = parseInt(m.materia_id, 10);
            const total = parseInt(m.total_alumnos, 10) || 0;
            if (!materiaId) continue;

            await query(
                `INSERT INTO planeacion_materias_semestre (semestre, materia_id, total_alumnos)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE total_alumnos = VALUES(total_alumnos)`,
                [semestre, materiaId, total]
            );
        }

        res.json({ mensaje: 'Planeación guardada correctamente.' });
    } catch (err) {
        console.error('❌ Error en POST /api/planeacion-semestre/:semestre:', err);
        res.status(500).json({ mensaje: 'Error al guardar planeación.', error: err.message });
    }
});

/* ======================== POST: generar grupos POR MATERIA ======================== */
/**
 * POST /api/planeacion-semestre/:semestre/generar-grupos-materia
 * Body: { materias: [ { materia_id, total_alumnos }, ... ] }  (opcional)
 *
 * Por cada materia del semestre:
 *   - lee total_alumnos
 *   - si total >= 10 → crea grupos: Materia A, Materia B, ...
 *     usando máx 30 alumnos por grupo y distribución balanceada.
 *   - guarda en tabla grupos_materia
 */
router.post('/:semestre/generar-grupos-materia', async (req, res) => {
    const materiasBody = Array.isArray(req.body.materias) ? req.body.materias : [];

    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre) || semestre < 1 || semestre > 9) {
            return res.status(400).json({ mensaje: 'Semestre inválido (1–9).' });
        }

        // 1) Si vienen materias en el body, primero actualizamos planeación
        if (materiasBody.length) {
            for (const m of materiasBody) {
                const materiaId = parseInt(m.materia_id, 10);
                const total = parseInt(m.total_alumnos, 10) || 0;
                if (!materiaId) continue;

                await query(
                    `INSERT INTO planeacion_materias_semestre (semestre, materia_id, total_alumnos)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE total_alumnos = VALUES(total_alumnos)`,
                    [semestre, materiaId, total]
                );
            }
        }

        // 2) Leer planeación y nombres de materias
        const planeacion = await query(
            `SELECT p.materia_id, p.total_alumnos, m.nombre
             FROM planeacion_materias_semestre p
             JOIN materias m ON m.id = p.materia_id
             WHERE p.semestre = ?`,
            [semestre]
        );

        if (!planeacion.length) {
            return res.status(400).json({
                mensaje: 'No hay planeación de alumnos para este semestre.'
            });
        }

        const resultados = [];

        // 3) Por cada materia calculamos grupos y los guardamos
        for (const p of planeacion) {
            const materiaId   = p.materia_id;
            const total       = Number(p.total_alumnos || 0);
            const nombreMat   = p.nombre;

            // Si no hay alumnos, borramos grupos que hubiera y seguimos
            if (total === 0) {
                await query('DELETE FROM grupos_materia WHERE materia_id = ?', [materiaId]);
                resultados.push({
                    materia_id: materiaId,
                    nombre_materia: nombreMat,
                    total_alumnos: 0,
                    numGrupos: 0,
                    grupos: []
                });
                continue;
            }

            if (total < 10) {
                return res.status(400).json({
                    mensaje: `La materia "${nombreMat}" tiene menos de 10 alumnos (${total}).`
                });
            }

            // Número de grupos: máximo 30 por grupo
            let numGrupos = Math.ceil(total / 30);

            // Distribución equilibrada
            const base  = Math.floor(total / numGrupos);
            const resto = total % numGrupos;  // las primeras "resto" llevan +1

            const tamanos = [];
            for (let i = 0; i < numGrupos; i++) {
                let size = base + (i < resto ? 1 : 0);
                if (size > 30) size = 30;
                tamanos.push(size);
            }

            // 3.1 Borrar grupos anteriores de esa materia
            await query('DELETE FROM grupos_materia WHERE materia_id = ?', [materiaId]);

            // 3.2 Insertar nuevos
            const gruposMateria = [];

            for (let i = 0; i < numGrupos; i++) {
                const letra = String.fromCharCode('A'.charCodeAt(0) + i);  // A, B, C...
                const numEst = tamanos[i];
                const nombreGrupo = `${nombreMat} ${letra}`;

                const result = await query(
                    `INSERT INTO grupos_materia (materia_id, letra, nombre_grupo, num_estudiantes)
                     VALUES (?, ?, ?, ?)`,
                    [materiaId, letra, nombreGrupo, numEst]
                );

                gruposMateria.push({
                    id: result.insertId,
                    materia_id: materiaId,
                    nombre_grupo: nombreGrupo,
                    letra,
                    num_estudiantes: numEst
                });
            }

            resultados.push({
                materia_id: materiaId,
                nombre_materia: nombreMat,
                total_alumnos: total,
                numGrupos,
                grupos: gruposMateria
            });
        }

        res.json({
            mensaje: `Grupos por materia generados para el semestre ${semestre}.`,
            resultados
        });

    } catch (err) {
        console.error('❌ Error en POST /api/planeacion-semestre/:semestre/generar-grupos-materia:', err);
        res.status(500).json({ mensaje: 'Error al generar grupos por materia.', error: err.message });
    }
});

module.exports = router;

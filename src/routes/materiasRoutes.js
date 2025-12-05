// src/routes/materiasRoutes.js
const express = require('express');
const router = express.Router();
const materiasController = require('../controllers/materiasController');
const { query } = require('../config/db');

// GET /api/materias
router.get('/', materiasController.listarMaterias);

// GET /api/materias/:id
router.get('/:id', materiasController.obtenerMateria);

// POST /api/materias
router.post('/', materiasController.crearMateria);

// PUT /api/materias/:id
router.put('/:id', materiasController.actualizarMateria);

// DELETE /api/materias/:id
router.delete('/:id', materiasController.eliminarMateria);

// GET /api/materias/semestre/:semestre
router.get('/semestre/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre)) {
            return res.status(400).json({ mensaje: 'semestre inválido' });
        }

        const rows = await query(
            `SELECT *
             FROM materias
             WHERE semestre = ?
             ORDER BY nombre`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/materias/semestre/:semestre:', err);
        res.status(500).json({
            mensaje: 'Error al obtener materias por semestre',
            error: err.message
        });
    }
});

module.exports = router;

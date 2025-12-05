// src/routes/maestrosRoutes.js
const express = require('express');
const router = express.Router();
const maestrosController = require('../controllers/maestrosController');

// GET /api/maestros
router.get('/', maestrosController.listarMaestros);

// GET /api/maestros/:id (opcional, si lo usas)
router.get('/:id', maestrosController.obtenerMaestro);

// POST /api/maestros
router.post('/', maestrosController.crearMaestro);

// PUT /api/maestros/:id
router.put('/:id', maestrosController.actualizarMaestro);

// DELETE /api/maestros/:id
router.delete('/:id', maestrosController.eliminarMaestro);

module.exports = router;

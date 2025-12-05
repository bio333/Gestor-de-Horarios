// src/routes/gruposRoutes.js
const express = require('express');
const router = express.Router();
const gruposController = require('../controllers/gruposController');

// CRUD de grupos
router.get('/', gruposController.listarGrupos);
router.get('/:id', gruposController.obtenerGrupo);
router.post('/', gruposController.crearGrupo);
router.put('/:id', gruposController.actualizarGrupo);
router.delete('/:id', gruposController.eliminarGrupo);

module.exports = router;

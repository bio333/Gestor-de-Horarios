//src/routes/salonesRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Solo para verificar en consola
console.log('✅ salonesRoutes cargado');

// GET /api/salones  → lista todos los salones
router.get('/', async (req, res) => {
    const sql = `
        SELECT id, edificio_id, clave, capacidad
        FROM salones
        ORDER BY edificio_id, clave
    `;

    try {
        // Como db.query es async, usamos await
        const rows = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/salones:', err);
        res.status(500).json({ mensaje: 'Error al obtener salones' });
    }
});

module.exports = router;


//eliminar este comentario
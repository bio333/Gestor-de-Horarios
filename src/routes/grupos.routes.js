const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Obtener todos los grupos
router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM grupos");
        res.json(rows);
    } catch (error) {
        console.error("Error en GET /api/grupos", error);
        res.status(500).json({ error: "Error al obtener los grupos" });
    }
});

module.exports = router;

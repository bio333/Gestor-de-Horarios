// src/controllers/materiasController.js
const Materia = require('../models/Materia');

// GET /api/materias
exports.listarMaterias = async (req, res) => {
    try {
        const materias = await Materia.obtenerTodas();
        res.json(materias);
    } catch (err) {
        console.error('❌ Error al listar materias:', err);
        res.status(500).json({ mensaje: 'Error al listar materias' });
    }
};

// GET /api/materias/:id
exports.obtenerMateria = async (req, res) => {
    try {
        const id = req.params.id;
        const materia = await Materia.obtenerPorId(id);

        if (!materia) {
            return res.status(404).json({ mensaje: 'Materia no encontrada' });
        }

        res.json(materia);
    } catch (err) {
        console.error('❌ Error al obtener materia:', err);
        res.status(500).json({ mensaje: 'Error al obtener materia' });
    }
};

// POST /api/materias
exports.crearMateria = async (req, res) => {
    try {
        const { nombre, creditos, semestre } = req.body;

        const creditosNum = parseInt(creditos, 10);
        const semestreNum = parseInt(semestre, 10);

        if (!nombre || Number.isNaN(creditosNum) || Number.isNaN(semestreNum)) {
            return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
        }

        // Solo 4, 5 o 6 créditos
        if (![4, 5, 6].includes(creditosNum)) {
            return res.status(400).json({ mensaje: 'Los créditos deben ser 4, 5 o 6' });
        }

        // Semestre 1–9
        if (semestreNum < 1 || semestreNum > 9) {
            return res.status(400).json({ mensaje: 'El semestre debe estar entre 1 y 9' });
        }

        const nueva = await Materia.crear({
            nombre,
            creditos: creditosNum,
            semestre: semestreNum
        });
        res.status(201).json(nueva);
    } catch (err) {
        console.error('❌ Error al crear materia:', err);
        res.status(500).json({ mensaje: 'Error al crear materia' });
    }
};

// PUT /api/materias/:id
exports.actualizarMateria = async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, creditos, semestre } = req.body;

        const creditosNum = parseInt(creditos, 10);
        const semestreNum = parseInt(semestre, 10);

        if (!nombre || Number.isNaN(creditosNum) || Number.isNaN(semestreNum)) {
            return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
        }

        if (![4, 5, 6].includes(creditosNum)) {
            return res.status(400).json({ mensaje: 'Los créditos deben ser 4, 5 o 6' });
        }

        if (semestreNum < 1 || semestreNum > 9) {
            return res.status(400).json({ mensaje: 'El semestre debe estar entre 1 y 9' });
        }

        const actualizada = await Materia.actualizar(id, {
            nombre,
            creditos: creditosNum,
            semestre: semestreNum
        });
        res.json(actualizada);
    } catch (err) {
        console.error('❌ Error al actualizar materia:', err);
        res.status(500).json({ mensaje: 'Error al actualizar materia' });
    }
};

// DELETE /api/materias/:id
exports.eliminarMateria = async (req, res) => {
    try {
        const id = req.params.id;
        await Materia.eliminar(id);
        res.json({ mensaje: 'Materia eliminada correctamente' });
    } catch (err) {
        console.error('❌ Error al eliminar materia:', err);
        res.status(500).json({ mensaje: 'Error al eliminar materia' });
    }
};

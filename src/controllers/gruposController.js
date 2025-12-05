// src/controllers/gruposController.js
const Grupo = require('../models/Grupo');

// GET /api/grupos
exports.listarGrupos = async (req, res) => {
    try {
        const grupos = await Grupo.obtenerTodos();
        res.json(grupos);
    } catch (err) {
        console.error('❌ Error al listar grupos:', err);
        res.status(500).json({ mensaje: 'Error al listar grupos' });
    }
};

// GET /api/grupos/:id
exports.obtenerGrupo = async (req, res) => {
    try {
        const id = req.params.id;
        const grupo = await Grupo.obtenerPorId(id);

        if (!grupo) {
            return res.status(404).json({ mensaje: 'Grupo no encontrado' });
        }

        res.json(grupo);
    } catch (err) {
        console.error('❌ Error al obtener grupo:', err);
        res.status(500).json({ mensaje: 'Error al obtener grupo' });
    }
};

// POST /api/grupos
exports.crearGrupo = async (req, res) => {
    try {
        const { semestre, grupo, num_estudiantes, salon_id } = req.body;

        if (!semestre || !grupo) {
            return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
        }

        const nuevo = await Grupo.crear({
            semestre,
            grupo,
            num_estudiantes,
            salon_id
        });

        res.status(201).json(nuevo);
    } catch (err) {
        console.error('❌ Error al crear grupo:', err);
        res.status(500).json({ mensaje: 'Error al crear grupo' });
    }
};

// PUT /api/grupos/:id
exports.actualizarGrupo = async (req, res) => {
    try {
        const id = req.params.id;
        const { semestre, grupo, num_estudiantes, salon_id } = req.body;

        if (!semestre || !grupo) {
            return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
        }

        const actualizado = await Grupo.actualizar(id, {
            semestre,
            grupo,
            num_estudiantes,
            salon_id
        });

        res.json(actualizado);
    } catch (err) {
        console.error('❌ Error al actualizar grupo:', err);
        res.status(500).json({ mensaje: 'Error al actualizar grupo' });
    }
};

// DELETE /api/grupos/:id
exports.eliminarGrupo = async (req, res) => {
    try {
        const id = req.params.id;
        await Grupo.eliminar(id);
        res.json({ mensaje: 'Grupo eliminado correctamente' });
    } catch (err) {
        console.error('❌ Error al eliminar grupo:', err);
        res.status(500).json({ mensaje: 'Error al eliminar grupo' });
    }
};

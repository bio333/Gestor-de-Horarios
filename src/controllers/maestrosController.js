    // src/controllers/maestrosController.js
    const Maestro = require('../models/Maestro');
    const { query } = require('../config/db');
    const bcrypt = require('bcryptjs');

    // GET /api/maestros
    exports.listarMaestros = async (req, res) => {
        try {
            const maestros = await Maestro.obtenerTodos();
            res.json(maestros);
        } catch (err) {
            console.error('❌ Error al listar maestros:', err);
            res.status(500).json({ mensaje: 'Error al listar maestros' });
        }
    };

    // GET /api/maestros/:id
    exports.obtenerMaestro = async (req, res) => {
        try {
            const id = req.params.id;
            const maestro = await Maestro.obtenerPorId(id);

            if (!maestro) {
                return res.status(404).json({ mensaje: 'Maestro no encontrado' });
            }

            res.json(maestro);
        } catch (err) {
            console.error('❌ Error al obtener maestro:', err);
            res.status(500).json({ mensaje: 'Error al obtener maestro' });
        }
    };

    // POST /api/maestros
    // Crea maestro EN docentes y usuario EN usuarios.
    exports.crearMaestro = async (req, res) => {
        try {
            const { nombre, tipo_contrato, password } = req.body;

            if (!nombre || !tipo_contrato || !password) {
                return res.status(400).json({ mensaje: 'Faltan datos obligatorios (nombre, tipo_contrato, password)' });
            }

            // 1) Crear maestro en tabla docentes (con horas calculadas)
            const nuevoMaestro = await Maestro.crear({
                nombre,
                tipo_contrato
            });

            // 2) Crear usuario para login
            const username = nombre; // puedes cambiarlo si luego quieres otro formato
            const passwordHash = await bcrypt.hash(password, 10);

            const usuarioRes = await query(
                `INSERT INTO usuarios (username, password_hash, rol, docente_id)
                VALUES (?, ?, 'maestro', ?)`,
                [username, passwordHash, nuevoMaestro.id]
            );

            const usuarioId = usuarioRes.insertId;

            // 3) Guardar usuario_id en docentes
            await query(
                `UPDATE docentes SET usuario_id = ? WHERE id = ?`,
                [usuarioId, nuevoMaestro.id]
            );

            res.status(201).json({
                ...nuevoMaestro,
                usuario_id: usuarioId
            });
        } catch (err) {
            console.error('❌ Error al crear maestro:', err);
            res.status(500).json({ mensaje: 'Error al crear maestro' });
        }
    };

    // PUT /api/maestros/:id
    // Actualiza datos del maestro y opcionalmente su contraseña.
    exports.actualizarMaestro = async (req, res) => {
        try {
            const id = req.params.id;
            const { nombre, tipo_contrato, password } = req.body;

            if (!nombre || !tipo_contrato) {
                return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
            }

            const maestroActual = await Maestro.obtenerPorId(id);
            if (!maestroActual) {
                return res.status(404).json({ mensaje: 'Maestro no encontrado' });
            }

            // 1) Actualizar datos del maestro (docentes)
            const actualizado = await Maestro.actualizar(id, {
                nombre,
                tipo_contrato
            });

            // 2) Si existe usuario asociado, actualizamos username y opcionalmente password
            if (maestroActual.usuario_id) {
                const username = nombre;

                // Actualizar username
                await query(
                    `UPDATE usuarios SET username = ? WHERE id = ?`,
                    [username, maestroActual.usuario_id]
                );

                // Si vino una nueva contraseña, actualizar hash
                if (password && password.trim() !== '') {
                    const passwordHash = await bcrypt.hash(password, 10);
                    await query(
                        `UPDATE usuarios SET password_hash = ? WHERE id = ?`,
                        [passwordHash, maestroActual.usuario_id]
                    );
                }
            }

            res.json(actualizado);
        } catch (err) {
            console.error('❌ Error al actualizar maestro:', err);
            res.status(500).json({ mensaje: 'Error al actualizar maestro' });
        }
    };

    // DELETE /api/maestros/:id
    // Borra maestro y también su usuario asociado.
    exports.eliminarMaestro = async (req, res) => {
        try {
            const id = req.params.id;

            const maestro = await Maestro.obtenerPorId(id);
            if (!maestro) {
                return res.status(404).json({ mensaje: 'Maestro no encontrado' });
            }

            // Primero, si tiene usuario asociado, lo eliminamos
            if (maestro.usuario_id) {
                await query(
                    `DELETE FROM usuarios WHERE id = ?`,
                    [maestro.usuario_id]
                );
            }

            // Luego eliminamos el maestro
            await Maestro.eliminar(id);

            res.json({ mensaje: 'Maestro eliminado correctamente' });
        } catch (err) {
            console.error('❌ Error al eliminar maestro:', err);
            res.status(500).json({ mensaje: 'Error al eliminar maestro' });
        }
    };

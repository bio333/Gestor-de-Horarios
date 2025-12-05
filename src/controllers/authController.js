// src/controllers/authController.js
const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('🔐 Intento de login:', { username, password });

        if (!username || !password) {
            return res.status(400).json({
                mensaje: 'Faltan datos: usuario y contraseña son obligatorios'
            });
        }

        // TRIM en username por si en la BD hay espacios extra
        const usuarios = await query(
            // 👇👇 IMPORTANTE: ahora también traemos docente_id
            'SELECT id, username, password_hash, rol, docente_id FROM usuarios WHERE TRIM(username) = ?',
            [username]
        );

        if (!usuarios || usuarios.length === 0) {
            console.log('⚠ Usuario no encontrado en BD');
            return res.status(401).json({
                mensaje: 'Usuario o contraseña incorrectos'
            });
        }

        const user = usuarios[0];
        console.log('✅ Usuario encontrado:', {
            id: user.id,
            username: user.username,
            rol: user.rol,
            docente_id: user.docente_id,
            hashLength: user.password_hash ? user.password_hash.length : 0
        });

        let passwordOk = false;

        // 1) Caso viejo: contraseña guardada en texto plano
        if (user.password_hash === password) {
            console.log('⚠ Coincidencia por texto plano (sin hash).');
            passwordOk = true;
        } else if (user.password_hash) {
            // 2) Caso normal: bcrypt
            passwordOk = await bcrypt.compare(password, user.password_hash);
        } else {
            passwordOk = false;
        }

        if (!passwordOk) {
            console.log('❌ Contraseña incorrecta para', username);
            return res.status(401).json({
                mensaje: 'Usuario o contraseña incorrectos'
            });
        }

        console.log('🎉 Login correcto para', username);

        // ⭐⭐⭐ AQUI GUARDAMOS LA SESIÓN ⭐⭐⭐
        // Esto es lo que luego usará getMaestroIdFromReq(req)
        req.session.user = {
            id: user.id,
            username: user.username,
            rol: user.rol,
            docente_id: user.docente_id   // <- para saber qué docente es
        };

        // Puedes ver qué quedó en sesión:
        console.log('🧑‍💻 Sesión guardada:', req.session.user);

        // Respondemos al frontend (puedes redirigir desde JS según el rol)
        return res.json({
            mensaje: 'Login exitoso',
            id: user.id,
            username: user.username,
            rol: user.rol,
            docente_id: user.docente_id
        });

    } catch (err) {
        console.error('❌ Error en login:', err);
        return res.status(500).json({
            mensaje: 'Error interno en el servidor',
            error: err.message
        });
    }
};

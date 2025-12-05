// index.js
require('dotenv').config();        // ⬅️ NUEVO

const express = require('express');
const app = express();
require('./src/config/db');
const session = require('express-session');

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static('src/public'));

// Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'gestor-horarios-super-secreto-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2  // 2 horas
    }
}));

// Rutas API
app.use('/api', require('./src/routes/maestrosMateriasRoutes'));

app.use('/api/maestros', require('./src/routes/maestrosRoutes'));
app.use('/api/materias', require('./src/routes/materiasRoutes'));
app.use('/api/grupos', require('./src/routes/gruposRoutes'));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/salones', require('./src/routes/salonesRoutes'));
app.use('/api/horarios', require('./src/routes/horariosRoutes'));
app.use('/api/planeacion-semestre', require('./src/routes/planeacionSemestreRoutes'));
app.use('/api/grupos-materia', require('./src/routes/gruposMateriaRoutes'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});

// Exportar para Railway
module.exports = app;

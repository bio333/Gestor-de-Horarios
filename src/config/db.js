// src/config/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'switchback.proxy.rlwy.net',   // host de Railway
    user: 'root',
    password: 'ZjuHrrRyXZPoMoxXdkBeffJjakCpxQVC',  // <-- pon la tuya
    database: 'railway',                 // nombre del schema en Railway
    port: 29220,                         // puerto de Railway
    ssl: {
        rejectUnauthorized: false        // 👈 aceptar certificado self-signed
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper genérico para queries
async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = {
    pool,
    query
};

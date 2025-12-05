// src/config/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// Crear el pool UNA sola vez
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_DATABASE || 'gestor_horarios',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  // En Railway usamos SSL; en local no hace falta
  ssl: process.env.MYSQLHOST
    ? { rejectUnauthorized: false }
    : undefined
});

// Función wrapper para que NUNCA se pierda el this del pool
async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Pequeña prueba al arrancar
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conectado a MySQL correctamente');
  } catch (err) {
    console.error('❌ Error al conectar a MySQL:', err.message);
  }
})();

module.exports = { pool, query };

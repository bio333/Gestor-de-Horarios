require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'gestor_horarios',
  port: process.env.MYSQLPORT || 3306,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conectado a MySQL correctamente (Railway)');
  } catch (err) {
    console.error('❌ Error al conectar a MySQL:', err);
  }
})();

module.exports = pool;
//Bien
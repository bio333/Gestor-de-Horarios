// src/config/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// Solo para depurar en Railway (se verá en Logs)
console.log('🔌 MySQL config desde ENV:', {
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  database: process.env.MYSQLDATABASE
});

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,       // viene de Railway
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    ssl: { rejectUnauthorized: false }, // está bien así para Railway
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = { pool, query };

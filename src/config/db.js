// src/config/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

console.log('🔌 MySQL config desde ENV:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = { pool, query };

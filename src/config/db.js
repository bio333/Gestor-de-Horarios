require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    ssl: { rejectUnauthorized: false }
});

async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = { pool, query };

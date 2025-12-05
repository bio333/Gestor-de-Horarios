const db = require('../config/db');

const User = {
    encontrarPorUsername(username, callback) {
        const sql = 'SELECT * FROM usuarios WHERE username = ?';
        db.query(sql, [username], (err, rows) => {
            if (err) return callback(err, null);
            if (rows.length === 0) return callback(null, null);
            callback(null, rows[0]);
        });
    }
};

module.exports = User;

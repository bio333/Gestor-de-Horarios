const admin = require('firebase-admin');
const serviceAccount = require('../../clave_firebase.json'); // luego te digo cómo generar esto

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://TU_PROYECTO.firebaseio.com"
});

module.exports = admin;

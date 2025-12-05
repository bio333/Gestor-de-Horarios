// src/routes/horariosRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db'); // helper con Promises

// Días de la semana usados en la BD (tal como se guardan en la tabla horarios)
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

/* ======================== UTILIDADES ======================== */

/**
 * Devuelve la hora de receso según el semestre
 * 1–3  → 11
 * 4–6  → 12
 * 7–9  → 13
 */
function getRecesoHourForSemestre(semestre) {
    if (semestre >= 1 && semestre <= 3) return 11;
    if (semestre >= 4 && semestre <= 6) return 12;
    if (semestre >= 7 && semestre <= 9) return 13;
    return null;
}

// Convierte una hora entera (7,8,9...) a '07:00:00', '08:00:00', etc.
function horaEnteraAString(horaEntera) {
    const h = String(horaEntera).padStart(2, '0');
    return `${h}:00:00`;
}

/**
 * Verifica si un maestro ya tiene clase en ese día y horario
 * (excluyendo un horario_id si se indica)
 */
async function maestroOcupadoEnSlot(maestroId, dia, horaInicio, horaFin, excluirHorarioId = null) {
    const horaInicioStr = horaEnteraAString(horaInicio); // ej. '07:00:00'
    const horaFinStr    = horaEnteraAString(horaFin);    // ej. '08:00:00'

    let sql = `
        SELECT id
        FROM horarios
        WHERE maestro_id = ?
          AND dia = ?
          AND tipo = 'CLASE'
          -- Hay traslape si NO se cumple: fin_existente <= inicio_nuevo  O  inicio_existente >= fin_nuevo
          AND NOT (hora_fin <= ? OR hora_inicio >= ?)
    `;

    const params = [maestroId, dia, horaInicioStr, horaFinStr];

    if (excluirHorarioId) {
        sql += ' AND id <> ?';
        params.push(excluirHorarioId);
    }

    const rows = await query(sql, params);
    return rows.length > 0;
}

/**
 * Verifica si un grupo ya tiene clase en ese día y horario
 * (excluyendo un horario_id si se indica)
 */
async function grupoOcupadoEnSlot(grupoId, dia, horaInicio, horaFin, excluirHorarioId = null) {
    const horaInicioStr = horaEnteraAString(horaInicio);
    const horaFinStr    = horaEnteraAString(horaFin);

    let sql = `
        SELECT id
        FROM horarios
        WHERE grupo_id = ?
          AND dia = ?
          AND tipo = 'CLASE'
          AND NOT (hora_fin <= ? OR hora_inicio >= ?)
    `;
    const params = [grupoId, dia, horaInicioStr, horaFinStr];

    if (excluirHorarioId) {
        sql += ' AND id <> ?';
        params.push(excluirHorarioId);
    }

    const rows = await query(sql, params);
    return rows.length > 0;
}

/** Incrementa horas_asignadas de un maestro */
async function incrementarHorasMaestro(maestroId, horas) {
    await query(
        `UPDATE docentes
         SET horas_asignadas = COALESCE(horas_asignadas, 0) + ?
         WHERE id = ?`,
        [horas, maestroId]
    );
}

/** Decrementa horas_asignadas de un maestro */
async function decrementarHorasMaestro(maestroId, horas) {
    await query(
        `UPDATE docentes
         SET horas_asignadas = GREATEST(COALESCE(horas_asignadas, 0) - ?, 0)
         WHERE id = ?`,
        [horas, maestroId]
    );
}

/** Decrementa horas_asignadas de un maestro */
async function decrementarHorasMaestro(maestroId, horas) {
    await query(
        `UPDATE docentes
         SET horas_asignadas = GREATEST(COALESCE(horas_asignadas, 0) - ?, 0)
         WHERE id = ?`,
        [horas, maestroId]
    );
}

async function obtenerInfoMaestro(maestroId) {
    const rows = await query(
        `
        SELECT 
            d.id,
            d.nombre,
            d.tipo_contrato,
            d.horas_max_semana,
            (
                SELECT COUNT(*) 
                FROM horarios h 
                WHERE h.maestro_id = d.id
            ) AS horas_asignadas
        FROM docentes d
        WHERE d.id = ?
        `,
        [maestroId]
    );

    if (!rows.length) {
        throw new Error('Maestro no encontrado');
    }

    return rows[0];
}

// ====== SOLO PARA EL MAESTRO LOGUEADO (usa sesión) ======
function requireMaestro(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ mensaje: 'No autorizado' });
    }
    const rolSesion = (req.session.user.rol || '').toUpperCase();
    if (rolSesion !== 'MAESTRO') {
        return res.status(401).json({ mensaje: 'No autorizado' });
    }
    next();
}

// GET /api/horarios/maestro-info/mio
router.get('/maestro-info/mio', requireMaestro, async (req, res) => {
    try {
        // En tu login guardas el id del docente en user.id
        const maestroId = req.session.user.id || req.session.user.docente_id;
        const info = await obtenerInfoMaestro(maestroId);
        res.json(info);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/maestro-info/mio:', err);
        res.status(500).json({
            mensaje: 'Error al obtener información del maestro',
            error: err.message
        });
    }
});

// GET /api/horarios/maestro/mio
router.get('/maestro/mio', requireMaestro, async (req, res) => {
    try {
        const maestroId = req.session.user.id || req.session.user.docente_id;
        const horario = await obtenerHorarioMaestro(maestroId);
        res.json(horario);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/maestro/mio:', err);
        res.status(500).json({
            mensaje: 'Error al obtener horario',
            error: err.message
        });
    }
});


async function obtenerHorarioMaestro(maestroId) {
    const rows = await query(
        `SELECT  
             h.id,
             h.dia,
             h.materia_id,
             h.maestro_id,
             DATE_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
             DATE_FORMAT(h.hora_fin, '%H:%i')   AS hora_fin,
             m.nombre   AS materia,
             s.clave    AS salon
         FROM horarios h
         LEFT JOIN materias m ON m.id = h.materia_id
         LEFT JOIN salones  s ON s.id = h.salon_id
         WHERE h.maestro_id = ?
           AND h.tipo = 'CLASE'
         ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                  h.hora_inicio`,
        [maestroId]
    );

    return rows;
}


/**
 * Versión simple: elige un maestro que pueda impartir la materia.
 */
async function elegirMaestroParaMateriaEnSlot(materiaId, dia, horaInicio, horaFin) {
    let maestrosElegibles = await query(
        `SELECT d.*
         FROM docentes d
         JOIN maestros_materias mm ON mm.maestro_id = d.id
         WHERE mm.materia_id = ?`,
        [materiaId]
    );

    if (!maestrosElegibles.length) {
        console.warn(
            '⚠ No hay maestros registrados para materia_id =',
            materiaId,
            '→ usando cualquier maestro disponible.'
        );
        maestrosElegibles = await query('SELECT * FROM docentes');
    }

    if (maestrosElegibles.length) {
        return maestrosElegibles[0];
    }

    console.warn('⚠ No se encontró ningún maestro en la tabla docentes.');
    return null;
}

/* ======================== RUTAS BÁSICAS ======================== */

/**
 * GET /api/horarios/salon/:salonId
 * Devuelve todas las clases (tipo 'CLASE') que se dan en un salón,
 * con día, hora, maestro, materia y salón.
 */
router.get('/salon/:salonId', async (req, res) => {
    try {
        const { salonId } = req.params;

        if (!salonId) {
            return res.status(400).json({ mensaje: 'salonId es obligatorio' });
        }

        const rows = await query(
            `SELECT  
                 h.id,
                 h.dia,
                 DATE_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
                 DATE_FORMAT(h.hora_fin, '%H:%i')   AS hora_fin,
                 m.nombre   AS materia,
                 d.nombre   AS maestro,
                 s.clave    AS salon
             FROM horarios h
             LEFT JOIN materias m ON m.id = h.materia_id
             LEFT JOIN docentes d ON d.id = h.maestro_id
             LEFT JOIN salones s  ON s.id = h.salon_id
             WHERE h.salon_id = ?
               AND h.tipo = 'CLASE'
             ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                      h.hora_inicio`,
            [salonId]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/salon/:salonId:', err);
        res.status(500).json({
            mensaje: 'Error al obtener horario del salón',
            error: err.message
        });
    }
});

/**
 * GET /api/horarios?grupo_id=#
 * Devuelve todos los bloques (CLASE) de un grupo.
 */
router.get('/', async (req, res) => {
    try {
        const { grupo_id } = req.query;

        if (!grupo_id) {
            return res.status(400).json({ mensaje: 'grupo_id es obligatorio' });
        }

        const rows = await query(
            `SELECT  h.*,
                     m.nombre  AS materia_nombre,
                     d.nombre  AS maestro_nombre,
                     s.clave   AS salon_clave
             FROM horarios h
             LEFT JOIN materias m ON m.id = h.materia_id
             LEFT JOIN docentes d ON d.id = h.maestro_id
             LEFT JOIN salones  s ON s.id = h.salon_id
             WHERE h.grupo_id = ?
               AND h.tipo = 'CLASE'
             ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                      h.hora_inicio`,
            [grupo_id]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios:', err.message, err);
        res.status(500).json({
            mensaje: 'Error al obtener horarios',
            error: err.message
        });
    }
});

/* ======================== GENERADOR AUTOMÁTICO ======================== */

router.post('/generar', async (req, res) => { 
    try {
        // 1) Limpiar horarios y horas_asignadas
        await query('TRUNCATE TABLE horarios');
        await query('UPDATE docentes SET horas_asignadas = 0');

        // 2) Cargar datos base
        const grupos   = await query('SELECT * FROM grupos');
        const materias = await query('SELECT * FROM materias');
        const docentes = await query('SELECT * FROM docentes');
        const mmRows   = await query('SELECT * FROM maestros_materias');
        const salones  = await query('SELECT * FROM salones');

        // Mapear maestros por materia: materia_id -> [docentes...]
        const maestrosPorMateria = {};
        mmRows.forEach(r => {
            if (!maestrosPorMateria[r.materia_id]) {
                maestrosPorMateria[r.materia_id] = [];
            }
            const maestro = docentes.find(d => d.id === r.maestro_id);
            if (maestro) {
                maestrosPorMateria[r.materia_id].push(maestro);
            }
        });

        const todosLosDocentes = docentes;

        // Estructuras de ocupación
        const ocupacionGrupo   = new Set(); // `${grupoId}-${diaIndex}-${hora}`
        const ocupacionMaestro = new Set(); // `${maestroId}-${diaIndex}-${hora}`
        const ocupacionSalon   = new Set(); // `${salonId}-${diaIndex}-${hora}`

        const horasAsignadasPorMaestro = {};

        const HORA_INICIO = 7;
        const HORA_FIN    = 15;

        function elegirMaestrosPara(materiaId) {
            let lista = maestrosPorMateria[materiaId];
            if (!lista || !lista.length) return todosLosDocentes;
            return lista;
        }

        async function intentarAsignarEnDia(grupo, materia, diaIndex, recesoHour) {
            const diaNombre = DIAS[diaIndex];

            for (let hora = HORA_INICIO; hora < HORA_FIN; hora++) {
                if (recesoHour && hora === recesoHour) continue;

                const keyGrupo = `${grupo.id}-${diaIndex}-${hora}`;
                if (ocupacionGrupo.has(keyGrupo)) continue;

                const maestrosElegibles = elegirMaestrosPara(materia.id);
                let maestroSeleccionado = null;
                let keyMaestroSel = null;

                for (const maestro of maestrosElegibles) {
                    const keyM = `${maestro.id}-${diaIndex}-${hora}`;
                    if (!ocupacionMaestro.has(keyM)) {
                        maestroSeleccionado = maestro;
                        keyMaestroSel = keyM;
                        break;
                    }
                }

                if (!maestroSeleccionado) continue;

                let salonSeleccionado = null;
                let keySalonSel = null;

                for (const salon of salones) {
                    if (salon.capacidad < grupo.num_estudiantes) continue;

                    const keyS = `${salon.id}-${diaIndex}-${hora}`;
                    if (!ocupacionSalon.has(keyS)) {
                        salonSeleccionado = salon;
                        keySalonSel = keyS;
                        break;
                    }
                }

                if (!salonSeleccionado) continue;

                const horaInicioStr = horaEnteraAString(hora);
                const horaFinStr    = horaEnteraAString(hora + 1);

                await query(
                    `INSERT INTO horarios
                     (grupo_id, materia_id, maestro_id, salon_id, dia, hora_inicio, hora_fin, tipo)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'CLASE')`,
                    [
                        grupo.id,
                        materia.id,
                        maestroSeleccionado.id,
                        salonSeleccionado.id,
                        diaNombre,
                        horaInicioStr,
                        horaFinStr
                    ]
                );

                ocupacionGrupo.add(keyGrupo);
                ocupacionMaestro.add(keyMaestroSel);
                ocupacionSalon.add(keySalonSel);

                horasAsignadasPorMaestro[maestroSeleccionado.id] =
                    (horasAsignadasPorMaestro[maestroSeleccionado.id] || 0) + 1;

                return true;
            }

            return false;
        }

        async function intentarAsignarEnCualquierDia(grupo, materia, recesoHour) {
            for (let diaIndex = 0; diaIndex < DIAS.length; diaIndex++) {
                const ok = await intentarAsignarEnDia(grupo, materia, diaIndex, recesoHour);
                if (ok) return true;
            }
            return false;
        }

        for (const grupo of grupos) {
            const materiasDelSemestre = materias
                .filter(m => m.semestre === grupo.semestre)
                .sort((a, b) => {
                    const ma = (maestrosPorMateria[a.id] || todosLosDocentes).length;
                    const mb = (maestrosPorMateria[b.id] || todosLosDocentes).length;
                    if (ma !== mb) return ma - mb;
                    return (b.creditos || 0) - (a.creditos || 0);
                });

            const recesoHour = getRecesoHourForSemestre(grupo.semestre);

            for (const materia of materiasDelSemestre) {
                const creditos = materia.creditos || 0;

                let diasMateria = [];
                if (creditos === 4) diasMateria = [0, 1, 2, 3];
                else if (creditos === 5) diasMateria = [0, 1, 2, 3, 4];
                else if (creditos === 6) diasMateria = [0, 1, 2, 3, 4, 4];
                else {
                    for (let i = 0; i < creditos; i++) diasMateria.push(i % DIAS.length);
                }

                let sesionesAsignadas = 0;
                const sesionesDeseadas = diasMateria.length;

                for (const diaIndex of diasMateria) {
                    const ok = await intentarAsignarEnDia(grupo, materia, diaIndex, recesoHour);
                    if (ok) sesionesAsignadas++;
                }

                while (sesionesAsignadas < sesionesDeseadas) {
                    const ok = await intentarAsignarEnCualquierDia(grupo, materia, recesoHour);
                    if (!ok) {
                        console.warn(
                            `⚠ No se pudo asignar sesión para grupo_id=${grupo.id}, ` +
                            `materia_id=${materia.id} (faltaban ${sesionesDeseadas - sesionesAsignadas} horas)`
                        );
                        break;
                    }
                    sesionesAsignadas++;
                }
            }
        }

        for (const [maestroId, horas] of Object.entries(horasAsignadasPorMaestro)) {
            await query(
                `UPDATE docentes SET horas_asignadas = ? WHERE id = ?`,
                [horas, maestroId]
            );
        }

        res.json({
            mensaje: "Horarios generados correctamente (con orden de dificultad y plan B)."
        });

    } catch (err) {
        console.error('❌ Error al generar horarios:', err);
        res.status(500).json({
            mensaje: 'Error al generar horarios',
            error: err.message
        });
    }
});

/* ======================== EDITAR UN SLOT ======================== */

router.post('/editar-slot', async (req, res) => {
    try {
        const { grupo_id, dia, hora_inicio, materia_id, maestro_id, salon_id } = req.body;

        if (!grupo_id || !dia || hora_inicio === undefined) {
            return res.status(400).json({ mensaje: 'grupo_id, dia y hora_inicio son obligatorios' });
        }

        const horaInicio = parseInt(hora_inicio, 10);
        const salonId = salon_id ? parseInt(salon_id, 10) : null;
        const horaFin = horaInicio + 1;
        const horaInicioStr = horaEnteraAString(horaInicio);
        const horaFinStr = horaEnteraAString(horaFin);

        // 🔹 AHORA usamos grupos_materia (panel del jefe trabaja con esa tabla)
        const grupos = await query('SELECT * FROM grupos_materia WHERE id = ?', [grupo_id]);
        if (!grupos.length) {
            return res.status(400).json({ mensaje: 'Grupo no encontrado' });
        }
        const grupo = grupos[0];
        const recesoHour = getRecesoHourForSemestre(grupo.semestre);

        if (recesoHour && horaInicio === recesoHour) {
            return res.status(400).json({ mensaje: 'No se puede editar el bloque de RECESO.' });
        }

        const existentes = await query(
            `SELECT *
             FROM horarios
             WHERE grupo_id = ?
               AND dia = ?
               AND hora_inicio = ?
               AND tipo = 'CLASE'`,
            [grupo_id, dia, horaInicioStr]
        );
        const existente = existentes[0] || null;

        if (!materia_id || !maestro_id) {
            if (existente) {
                await decrementarHorasMaestro(existente.maestro_id, 1);
                await query('DELETE FROM horarios WHERE id = ?', [existente.id]);
            }
            return res.json({ mensaje: 'Bloque actualizado a LIBRE.' });
        }

        const materiaRows = await query(
            'SELECT creditos FROM materias WHERE id = ?',
            [materia_id]
        );
        if (!materiaRows.length) {
            return res.status(400).json({ mensaje: 'Materia no encontrada' });
        }
        const creditos = materiaRows[0].creditos || 0;

        let countSql = `
            SELECT COUNT(*) AS usadas
            FROM horarios
            WHERE grupo_id = ?
              AND materia_id = ?
              AND tipo = 'CLASE'
        `;
        const countParams = [grupo_id, materia_id];

        if (existente) {
            countSql += ' AND id <> ?';
            countParams.push(existente.id);
        }

        const countRows = await query(countSql, countParams);
        const usadas = countRows[0].usadas || 0;

        if (usadas + 1 > creditos) {
            return res.status(400).json({
                mensaje: `Esta materia solo permite ${creditos} horas por semana en este grupo. Libera una hora antes de reasignar.`
            });
        }

        const mm = await query(
            `SELECT 1
             FROM maestros_materias
             WHERE maestro_id = ? AND materia_id = ?`,
            [maestro_id, materia_id]
        );
        if (!mm.length) {
            return res.status(400).json({
                mensaje: 'Este maestro no tiene asignada esa materia (maestros_materias).'
            });
        }

        const ocupadoMaestro = await maestroOcupadoEnSlot(
            maestro_id,
            dia,
            horaInicio,
            horaFin,
            existente ? existente.id : null
        );
        if (ocupadoMaestro) {
            return res.status(400).json({
                mensaje: 'El maestro ya tiene clase en ese horario.'
            });
        }

        /**
 * Verifica si un salón ya tiene clase en ese día y horario
 * (excluyendo un horario_id si se indica)
 */
async function salonOcupadoEnSlot(salonId, dia, horaInicio, horaFin, excluirHorarioId = null) {
    const horaInicioStr = horaEnteraAString(horaInicio);
    const horaFinStr    = horaEnteraAString(horaFin);

    let sql = `
        SELECT id
        FROM horarios
        WHERE salon_id = ?
          AND dia = ?
          AND tipo = 'CLASE'
          AND NOT (hora_fin <= ? OR hora_inicio >= ?)
    `;
    const params = [salonId, dia, horaInicioStr, horaFinStr];

    if (excluirHorarioId) {
        sql += ' AND id <> ?';
        params.push(excluirHorarioId);
    }

    const rows = await query(sql, params);
    return rows.length > 0;
}


                const ocupadoGrupo = await grupoOcupadoEnSlot(
            grupo_id,
            dia,
            horaInicio,
            horaFin,
            existente ? existente.id : null
        );
        if (ocupadoGrupo) {
            return res.status(400).json({
                mensaje: 'El grupo ya tiene clase en ese horario.'
            });
        }

        // 🔹 VALIDAR SALÓN, si se envió
        if (salonId) {
            const ocupadoSalon = await salonOcupadoEnSlot(
                salonId,
                dia,
                horaInicio,
                horaFin,
                existente ? existente.id : null
            );
            if (ocupadoSalon) {
                return res.status(400).json({
                    mensaje: 'El salón ya está ocupado en ese horario.'
                });
            }
        }


        if (existente) {
            if (existente.maestro_id !== Number(maestro_id)) {
                await decrementarHorasMaestro(existente.maestro_id, 1);
                await incrementarHorasMaestro(maestro_id, 1);
            }

            await query(
                `UPDATE horarios
                 SET materia_id = ?, maestro_id = ? salon_id = ?
                 WHERE id = ?`,
                [materia_id, maestro_id, salonId, existente.id]
            );
                } else {
            await query(
                `INSERT INTO horarios
                 (grupo_id, materia_id, maestro_id, salon_id, dia, hora_inicio, hora_fin, tipo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'CLASE')`,
                [grupo_id, materia_id, maestro_id, salonId, dia, horaInicioStr, horaFinStr]
            );
            await incrementarHorasMaestro(maestro_id, 1);
        }


        res.json({ mensaje: 'Bloque actualizado correctamente.' });
    } catch (err) {
        console.error('❌ Error en /api/horarios/editar-slot:', err);
        res.status(500).json({
            mensaje: 'Error al editar bloque',
            error: err.message
        });
    }
});

/* ======================== LIBERAR UNA HORA EN TODOS LOS DÍAS ======================== */
/**
 * POST /api/horarios/liberar-hora
 * { grupo_id, hora_inicio }
 *
 * Libera esa hora (rango [hora, hora+1) ) en TODOS los días de la semana
 * para ese grupo, sin tocar el RECESO.
 */
router.post('/liberar-hora', async (req, res) => {
    try {
        const { grupo_id, hora_inicio } = req.body;

        if (!grupo_id || hora_inicio === undefined) {
            return res.status(400).json({
                mensaje: 'grupo_id y hora_inicio son obligatorios'
            });
        }

        const horaInicio    = parseInt(hora_inicio, 10);
        const horaInicioStr = horaEnteraAString(horaInicio);       // ej. '07:00:00'
        const horaFinStr    = horaEnteraAString(horaInicio + 1);   // ej. '08:00:00'

        // 🔹 Igual que arriba: consultar en grupos_materia
        const grupos = await query('SELECT * FROM grupos_materia WHERE id = ?', [grupo_id]);
        if (!grupos.length) {
            return res.status(400).json({ mensaje: 'Grupo no encontrado' });
        }
        const grupo = grupos[0];
        const recesoHour = getRecesoHourForSemestre(grupo.semestre);

        if (recesoHour && horaInicio === recesoHour) {
            return res.status(400).json({ mensaje: 'No se puede editar el bloque de RECESO.' });
        }

        // Buscar TODAS las clases de ese grupo cuyo inicio esté dentro de la hora [horaInicio, horaInicio+1)
        const filas = await query(
            `SELECT id, maestro_id
             FROM horarios
             WHERE grupo_id    = ?
               AND tipo        = 'CLASE'
               AND hora_inicio >= ?
               AND hora_inicio <  ?`,
            [grupo_id, horaInicioStr, horaFinStr]
        );

        // Restar horas al maestro y eliminar cada fila
        for (const fila of filas) {
            if (fila.maestro_id) {
                await decrementarHorasMaestro(fila.maestro_id, 1);
            }
            await query('DELETE FROM horarios WHERE id = ?', [fila.id]);
        }

        res.json({
            mensaje: `Bloque de las ${horaInicio}:00 liberado en todos los días (${filas.length} clase(s) eliminada(s)).`
        });
    } catch (err) {
        console.error('❌ Error en /api/horarios/liberar-hora:', err);
        res.status(500).json({
            mensaje: 'Error al liberar la hora en todos los días.',
            error: err.message
        });
    }
});

/* ======================== INFO DE UN MAESTRO (HORAS) ======================== */
/**
 * GET /api/horarios/maestro-info/:maestroId
 * Devuelve datos del maestro + horas restantes según horas_max_semana
 *
 * Tabla `docentes`:
 *   id, nombre, tipo_contrato, horas_max_semana, horas_asignadas
 */
router.get('/maestro-info/:maestroId', async (req, res) => {
    try {
        const maestroId = parseInt(req.params.maestroId, 10);
        if (isNaN(maestroId)) {
            return res.status(400).json({ mensaje: 'maestroId inválido' });
        }

        const info = await obtenerInfoMaestro(maestroId);
        return res.json(info);

    } catch (err) {
        console.error('❌ Error en GET /api/horarios/maestro-info/:maestroId:', err);
        res.status(500).json({
            mensaje: 'Error al obtener información del maestro',
            error: err.message
        });
    }
});


/* ======================== HORARIO DE UN MAESTRO ======================== */
/**
 * GET /api/horarios/maestro/:maestroId
 * Devuelve todas las clases (tipo 'CLASE') de un maestro
 * con día, hora, materia y salón.
 */
router.get('/maestro/:maestroId', async (req, res) => {
    try {
        const maestroId = parseInt(req.params.maestroId, 10);
        if (isNaN(maestroId)) {
            return res.status(400).json({ mensaje: 'maestroId inválido' });
        }

        const horario = await obtenerHorarioMaestro(maestroId);
        res.json(horario);

    } catch (err) {
        console.error('❌ Error en GET /api/horarios/maestro/:maestroId:', err);
        res.status(500).json({ mensaje: 'Error al obtener horario', error: err.message });
    }
});



/* ======================== ELIMINAR SOLO UNA CLASE ======================== */
/**
 * POST /api/horarios/eliminar-clase
 * { horario_id }
 *
 * Elimina SOLO ESA clase del maestro.
 */
router.post('/eliminar-clase', async (req, res) => {
    try {
        const { horario_id } = req.body;

        if (!horario_id) {
            return res.status(400).json({ mensaje: 'horario_id es obligatorio' });
        }

        // Obtener maestro de ese horario
        const rows = await query(
            `SELECT maestro_id
             FROM horarios
             WHERE id = ? AND tipo = 'CLASE'`,
            [horario_id]
        );

        if (!rows.length) {
            return res.status(404).json({ mensaje: 'Clase no encontrada.' });
        }

        const maestroId = rows[0].maestro_id;

        // Restar 1 hora al maestro
        if (maestroId) {
            await query(`
                UPDATE docentes
                SET horas_asignadas = GREATEST(horas_asignadas - 1, 0)
                WHERE id = ?
            `, [maestroId]);
        }

        // Eliminar clase
        await query('DELETE FROM horarios WHERE id = ?', [horario_id]);

        res.json({ mensaje: 'Clase eliminada correctamente.' });

    } catch (err) {
        console.error('❌ Error en POST /api/horarios/eliminar-clase:', err);
        res.status(500).json({
            mensaje: 'Error al eliminar la clase.',
            error: err.message
        });
    }
});

/* ======================== ELIMINAR TODA LA MATERIA DE UN MAESTRO ======================== */
/**
 * POST /api/horarios/eliminar-materia-completa
 * { maestro_id, materia, dia, hora_inicio }
 *
 * Elimina TODAS las horas de esa materia impartida por ese maestro,
 * en TODOS los grupos donde la tenga asignada.
 */
router.post('/eliminar-materia-completa', async (req, res) => {
    try {
        const { maestro_id, materia } = req.body;

        if (!maestro_id || !materia) {
            return res.status(400).json({ mensaje: 'Datos incompletos.' });
        }

        // Obtener todas las clases que coinciden con ese maestro y materia
        const rows = await query(
            `SELECT id, maestro_id
             FROM horarios
             WHERE maestro_id = ?
               AND tipo = 'CLASE'
               AND materia_id = (
                   SELECT id FROM materias WHERE nombre = ?
               )`,
            [maestro_id, materia]
        );

        if (!rows.length) {
            return res.status(404).json({ mensaje: 'No se encontraron clases de esa materia.' });
        }

        // Restar horas al maestro
        await query(
            `UPDATE docentes
             SET horas_asignadas = GREATEST(horas_asignadas - ?, 0)
             WHERE id = ?`,
            [rows.length, maestro_id]
        );

        // Eliminar TODAS esas clases
        for (const row of rows) {
            await query(`DELETE FROM horarios WHERE id = ?`, [row.id]);
        }

        res.json({
            mensaje: `Materia eliminada completamente (${rows.length} hora(s)).`
        });

    } catch (err) {
        console.error('❌ Error al eliminar materia completa:', err);
        res.status(500).json({
            mensaje: 'Error al eliminar materia completa.',
            error: err.message
        });
    }
});

// Obtener cuántas horas usa cada materia en un grupo
router.get('/materias/usadas-por-grupo/:grupoId', async (req, res) => {
    try {
        const grupoId = req.params.grupoId;

        const rows = await query(`
            SELECT materia_id, COUNT(*) AS usadas
            FROM horarios
            WHERE grupo_id = ?
              AND tipo = 'CLASE'
            GROUP BY materia_id
        `, [grupoId]);

        const mapa = {};
        rows.forEach(r => {
            mapa[r.materia_id] = r.usadas;
        });

        res.json(mapa);

    } catch (err) {
        console.error("Error en usadas-por-grupo:", err);
        res.status(500).json({ mensaje: "Error al obtener usos de materias" });
    }
});

/* ======================== ASIGNAR SALÓN A TODA LA MATERIA ======================== */
/**
 * POST /api/horarios/asignar-salon-materia
 * { grupo_id, materia_id, salon_id }
 *
 * Asigna el salón indicado a TODAS las clases (tipo 'CLASE') de esa materia
 * en ese grupo, validando que no genere choques de salón.
 */
router.post('/asignar-salon-materia', async (req, res) => {
    try {
        const { grupo_id, materia_id, salon_id } = req.body;

        if (!grupo_id || !materia_id || !salon_id) {
            return res.status(400).json({
                mensaje: 'grupo_id, materia_id y salon_id son obligatorios'
            });
        }

        // Verificar que exista el salón
        const salonRows = await query(
            'SELECT id, clave FROM salones WHERE id = ?',
            [salon_id]
        );
        if (!salonRows.length) {
            return res.status(400).json({ mensaje: 'Salón no encontrado.' });
        }

        // Verificar que el grupo tenga clases de esa materia
        const clasesMateria = await query(
            `SELECT dia, hora_inicio
             FROM horarios
             WHERE grupo_id = ?
               AND materia_id = ?
               AND tipo = 'CLASE'`,
            [grupo_id, materia_id]
        );

        if (!clasesMateria.length) {
            return res.status(400).json({
                mensaje: 'Este grupo no tiene clases de esa materia.'
            });
        }

        // Revisar choques de salón:
        // mismo salón, mismo día y hora, pero otro grupo
        const conflictos = await query(
            `SELECT h2.dia,
                    DATE_FORMAT(h2.hora_inicio, '%H:%i') AS hora_inicio,
                    g.semestre,
                    g.grupo
             FROM horarios h1
             JOIN horarios h2
               ON h1.dia = h2.dia
              AND h1.hora_inicio = h2.hora_inicio
             JOIN grupos g
               ON g.id = h2.grupo_id
             WHERE h1.grupo_id   = ?
               AND h1.materia_id = ?
               AND h1.tipo       = 'CLASE'
               AND h2.tipo       = 'CLASE'
               AND h2.salon_id   = ?
               AND h2.grupo_id  <> ?`,
            [grupo_id, materia_id, salon_id, grupo_id]
        );

        if (conflictos.length) {
            const detalle = conflictos
                .map(c => `${c.dia} ${c.hora_inicio} (Sem ${c.semestre} Grupo ${c.grupo})`)
                .join(', ');
            return res.status(400).json({
                mensaje: 'El salón ya está ocupado en alguno de esos horarios: ' + detalle
            });
        }

        // Si no hay choques, actualizar todas las clases de esa materia y grupo
        await query(
            `UPDATE horarios
             SET salon_id = ?
             WHERE grupo_id   = ?
               AND materia_id = ?
               AND tipo       = 'CLASE'`,
            [salon_id, grupo_id, materia_id]
        );

        res.json({
            mensaje: 'Salón asignado a todas las horas de la materia en este grupo.'
        });

    } catch (err) {
        console.error('❌ Error en POST /api/horarios/asignar-salon-materia:', err);
        res.status(500).json({
            mensaje: 'Error al asignar salón a la materia.',
            error: err.message
        });
    }
});

/**
 * GET /api/horarios/por-semestre/:semestre
 *
 * Devuelve TODAS las clases (tipo 'CLASE') de TODOS los grupos_materia
 * de ese semestre, con día, hora, materia, grupo, maestro y salón.
 */
router.get('/por-semestre/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre)) {
            return res.status(400).json({ mensaje: 'semestre inválido' });
        }

        const rows = await query(
            `SELECT
                 h.id,
                 h.dia,
                 DATE_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
                 DATE_FORMAT(h.hora_fin, '%H:%i')   AS hora_fin,
                 h.materia_id,
                 h.maestro_id,
                 h.salon_id,
                 gm.id          AS grupo_materia_id,
                 gm.nombre_grupo,
                 gm.semestre,
                 m.nombre       AS materia_nombre,
                 d.nombre       AS maestro_nombre,
                 s.clave        AS salon_clave
             FROM horarios h
             JOIN grupos_materia gm ON gm.id = h.grupo_id
             LEFT JOIN materias m   ON m.id = h.materia_id
             LEFT JOIN docentes d   ON d.id = h.maestro_id
             LEFT JOIN salones s    ON s.id = h.salon_id
             WHERE gm.semestre = ?
               AND h.tipo = 'CLASE'
             ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                      h.hora_inicio`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/por-semestre/:semestre:', err);
        res.status(500).json({
            mensaje: 'Error al obtener horarios del semestre',
            error: err.message
        });
    }
});

/**
 * GET /api/horarios/por-semestre/:semestre
 *
 * Devuelve TODAS las clases (tipo 'CLASE') de TODOS los grupos_materia
 * de ese semestre, con día, hora, materia, grupo, maestro y salón.
 */
router.get('/por-semestre/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre)) {
            return res.status(400).json({ mensaje: 'semestre inválido' });
        }

        const rows = await query(
            `SELECT
                 h.id,
                 h.dia,
                 DATE_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
                 DATE_FORMAT(h.hora_fin, '%H:%i')   AS hora_fin,
                 h.materia_id,
                 h.maestro_id,
                 h.salon_id,
                 gm.id          AS grupo_materia_id,
                 gm.nombre_grupo,
                 gm.semestre,
                 m.nombre       AS materia_nombre,
                 d.nombre       AS maestro_nombre,
                 s.clave        AS salon_clave
             FROM horarios h
             JOIN grupos_materia gm ON gm.id = h.grupo_id
             LEFT JOIN materias m   ON m.id = h.materia_id
             LEFT JOIN docentes d   ON d.id = h.maestro_id
             LEFT JOIN salones s    ON s.id = h.salon_id
             WHERE gm.semestre = ?
               AND h.tipo = 'CLASE'
             ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                      h.hora_inicio`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/por-semestre/:semestre:', err);
        res.status(500).json({
            mensaje: 'Error al obtener horarios del semestre',
            error: err.message
        });
    }
});

// ================= HORARIO COMPLETO DE UN SEMESTRE (por grupos_materia) =================
/**
 * GET /api/horarios/semestre/:semestre
 * Devuelve TODAS las clases (tipo 'CLASE') de TODOS los grupos_materia
 * de ese semestre, con info de grupo y materia.
 */
router.get('/semestre/:semestre', async (req, res) => {
    try {
        const semestre = parseInt(req.params.semestre, 10);
        if (isNaN(semestre)) {
            return res.status(400).json({ mensaje: 'semestre inválido' });
        }

        const rows = await query(
            `SELECT 
                 h.id,
                 h.grupo_id,
                 h.materia_id,
                 h.maestro_id,
                 h.salon_id,
                 h.dia,
                 h.hora_inicio,
                 h.hora_fin,
                 h.tipo,
                 gm.nombre_grupo,              -- A, B, C...
                 gm.semestre,
                 m.nombre  AS materia_nombre,
                 d.nombre  AS maestro_nombre,
                 s.clave   AS salon_clave
             FROM horarios h
             JOIN grupos_materia gm ON gm.id = h.grupo_id
             LEFT JOIN materias m   ON m.id = h.materia_id
             LEFT JOIN docentes d   ON d.id = h.maestro_id
             LEFT JOIN salones s    ON s.id = h.salon_id
             WHERE gm.semestre = ?
               AND h.tipo = 'CLASE'
             ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'),
                      h.hora_inicio,
                      gm.nombre_grupo`,
            [semestre]
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ Error en GET /api/horarios/semestre/:semestre:', err);
        res.status(500).json({
            mensaje: 'Error al obtener horario del semestre',
            error: err.message
        });
    }
});

// Ejemplo en routes/horarios.js

// requiere que el usuario logueado sea maestro
function requireMaestro(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ mensaje: 'No autorizado' });
    }
    const rolSesion = (req.session.user.rol || '').toUpperCase();
    if (rolSesion !== 'MAESTRO') {
        return res.status(401).json({ mensaje: 'No autorizado' });
    }
    next();
}






module.exports = router;

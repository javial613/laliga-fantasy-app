/**
 * Selección de cláusulas cuya protección está a punto de caer.
 *
 * El planteamiento evidente —comparar dos instantáneas y avisar de las que ya
 * se han abierto— no sirve aquí: GitHub ejecuta las tareas programadas cuando
 * puede, con huecos observados de 2 a 8 horas, así que el aviso llegaría
 * demasiado tarde para poder pagar la cláusula el primero.
 *
 * La fecha de apertura, sin embargo, se conoce de antemano: viene en cada
 * jugador. Así que en vez de detectar el cambio, se anuncia con antelación con
 * la hora exacta. Eso hace que el aviso sea útil aunque el vigilante corra de
 * forma irregular.
 */

/** Clave de aviso: un mismo jugador vuelve a anunciarse si cambia su fecha de
 *  apertura (p. ej. porque lo han blindado otras 24h). */
export const claveAviso = (playerId, lockedUntil) => `${playerId}|${lockedUntil || 'abierta'}`;

/**
 * @param {Object} jugadores    instantánea actual: playerId -> datos
 * @param {Object} opciones
 * @param {number} opciones.ahora            marca temporal de referencia
 * @param {number} opciones.ventanaHoras     con cuánta antelación se avisa
 * @param {Object} opciones.yaAvisados       claves ya notificadas
 * @param {string} [opciones.miEquipo]       teamId propio, para separar los avisos
 * @param {Map}    [opciones.nombrePorEquipo] teamId -> nombre del manager
 */
export const seleccionarAvisos = (jugadores, opciones = {}) => {
    const {
        ahora = Date.now(),
        ventanaHoras = 24,
        yaAvisados = {},
        miEquipo = null,
        nombrePorEquipo = new Map(),
    } = opciones;

    const limite = ahora + ventanaHoras * 3600 * 1000;
    const avisos = [];

    for (const [playerId, j] of Object.entries(jugadores || {})) {
        if (!j?.lockedUntil) continue;               // ya abierta: no hay nada que anunciar
        const apertura = new Date(j.lockedUntil).getTime();
        if (!Number.isFinite(apertura)) continue;
        if (apertura <= ahora) continue;             // ya pasó
        if (apertura > limite) continue;             // aún queda mucho

        const clave = claveAviso(playerId, j.lockedUntil);
        if (yaAvisados[clave]) continue;

        const esMio = miEquipo != null && String(j.teamId) === String(miEquipo);
        avisos.push({
            clave,
            playerId,
            nombre: j.name || playerId,
            teamId: j.teamId,
            manager: nombrePorEquipo.get?.(String(j.teamId)) || null,
            esMio,
            apertura,
            aperturaISO: j.lockedUntil,
            clausula: j.clause || 0,
            valor: j.marketValue || 0,
            // Cláusula por debajo del valor de mercado = ganga para quien la
            // pague. Es la señal que decide si merece la pena madrugar.
            gangaPor: (j.marketValue || 0) - (j.clause || 0),
        });
    }

    avisos.sort((a, b) => a.apertura - b.apertura);
    return avisos;
};

/** Descarta claves de aperturas ya pasadas para que el registro no crezca sin fin. */
export const limpiarAvisados = (yaAvisados, ahora = Date.now()) => {
    const limpio = {};
    for (const [clave, marca] of Object.entries(yaAvisados || {})) {
        if (typeof marca === 'number' && marca > ahora) limpio[clave] = marca;
    }
    return limpio;
};

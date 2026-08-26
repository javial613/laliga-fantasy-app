/**
 * Detección de subidas de cláusula a partir de instantáneas.
 *
 * Subir la cláusula de un jugador cuesta la mitad de lo que sube (la app lo
 * aplica en BuyoutFlow: la cláusula crece el doble de lo que pagas). Esa
 * operación **no genera ningún evento en el histórico de actividad**, así que
 * el saldo calculado se queda alto: falta el dinero gastado.
 *
 * La única forma de detectarlas es comparar el valor de la cláusula de cada
 * jugador entre dos momentos. El problema es separarlas de la revalorización
 * automática, y ahí lo que manda es *cuándo* ocurre el cambio:
 *
 *   - La revalorización de LaLiga se aplica en una franja corta del cambio de
 *     día (00:14–00:30 peninsular). Afecta a todos los jugadores a la vez y con
 *     porcentajes muy dispares (se han observado del 3% al 12% en la misma
 *     noche), así que NO se puede aislar por tamaño ni por proporción.
 *   - Una subida pagada ocurre a cualquier otra hora, cuando su dueño la hace.
 *
 * Por eso la regla es temporal, no estadística: solo se atribuye gasto cuando
 * las dos instantáneas caen **entre dos revalorizaciones**. Si el intervalo
 * cruza una madrugada, no hay forma de saber qué parte es automática, y se
 * prefiere no cobrar nada antes que inventar un importe.
 */

// Mínimo para considerar una diferencia como subida real y no ruido de redondeo.
const MINIMO_ABSOLUTO = 1000;

export const COSTE_POR_EURO_DE_SUBIDA = 0.5;

// Ventana diaria de revalorización, hora peninsular. Es estrecha a propósito:
// el cambio de valor se aplica siempre en esos pocos minutos del cambio de día,
// así que cualquier variación fuera de ella es dinero que alguien ha pagado.
// Cuanto más ajustada sea la ventana, menos intervalos hay que descartar.
const ZONA = 'Europe/Madrid';
const VENTANA_INICIO = { hora: 0, minuto: 14 };
const VENTANA_FIN = { hora: 0, minuto: 30 };

// Tope de días a examinar, por si el estado guardado es muy antiguo.
const MAX_DIAS = 400;

const PARTES = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Desfase de Madrid respecto a UTC en un instante dado (cambia con el horario de verano). */
const desfaseMadrid = (fecha) => {
    const p = PARTES.formatToParts(fecha).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    const hora = p.hour === '24' ? '00' : p.hour;
    const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hora, +p.minute, +p.second);
    return comoUTC - fecha.getTime();
};

/** Fecha local de Madrid (año, mes, día) de un instante. */
const diaMadrid = (fecha) => {
    const p = PARTES.formatToParts(fecha).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    return { anio: +p.year, mes: +p.month, dia: +p.day };
};

/** Instante UTC correspondiente a una hora local de Madrid. */
const instanteEnMadrid = ({ anio, mes, dia }, { hora, minuto }) => {
    let t = Date.UTC(anio, mes - 1, dia, hora, minuto);
    // Dos pasadas bastan para converger salvo en el salto horario, donde la
    // ventana no cae de todas formas.
    for (let i = 0; i < 2; i += 1) {
        t = Date.UTC(anio, mes - 1, dia, hora, minuto) - desfaseMadrid(new Date(t));
    }
    return t;
};

/**
 * ¿Se puede atribuir gasto entre estos dos momentos?
 *
 * Solo si el intervalo NO toca ninguna ventana de revalorización: dentro de
 * ella las cláusulas se mueven solas y no hay forma de separar qué parte pagó
 * alguien.
 */
export const intervaloAtribuible = (desde, hasta) => {
    // new Date(null) devuelve la época, no una fecha inválida: sin este filtro
    // un estado sin fecha se tomaría como 1970 y se recorrerían 400 días.
    if (desde == null || hasta == null) return false;
    const a = new Date(desde);
    const b = new Date(hasta);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    if (b.getTime() < a.getTime()) return false;

    let dia = diaMadrid(a);
    for (let i = 0; i < MAX_DIAS; i += 1) {
        const ini = instanteEnMadrid(dia, VENTANA_INICIO);
        const fin = instanteEnMadrid(dia, VENTANA_FIN);
        // Solape entre [a,b] y [ini,fin], con los extremos incluidos: rozar la
        // ventana ya basta para no fiarse, porque un falso cobro es peor que
        // una detección perdida.
        if (a.getTime() <= fin && b.getTime() >= ini) return false;
        if (ini > b.getTime()) break;
        const siguiente = new Date(Date.UTC(dia.anio, dia.mes - 1, dia.dia + 1, 12));
        dia = diaMadrid(siguiente);
    }
    return true;
};

/**
 * @param {Object} anterior playerId -> { teamId, clause, marketValue, name }
 * @param {Object} actual   igual
 * @param {{desde:string, hasta:string}} intervalo momentos de cada instantánea
 */
export const detectarSubidasDeClausula = (anterior, actual, intervalo = {}) => {
    const prev = anterior instanceof Map ? anterior : new Map(Object.entries(anterior || {}));
    const now = actual instanceof Map ? actual : new Map(Object.entries(actual || {}));

    const atribuible = intervaloAtribuible(intervalo.desde, intervalo.hasta);
    if (!atribuible) {
        return { subidas: [], atribuible: false, comparados: 0 };
    }

    const subidas = [];
    let comparados = 0;

    for (const [playerId, a] of now) {
        const b = prev.get(playerId);
        if (!b) continue;                       // fichado después: nada que comparar
        if (b.teamId !== a.teamId) continue;    // cambió de dueño: la cláusula se recalcula
        if (!(b.clause > 0) || !(a.clause > 0)) continue;
        comparados += 1;

        const subida = a.clause - b.clause;
        if (subida < MINIMO_ABSOLUTO) continue;

        subidas.push({
            playerId,
            playerName: a.name || b.name || null,
            teamId: a.teamId,
            clauseAnterior: b.clause,
            clauseActual: a.clause,
            subida: Math.round(subida),
            coste: Math.round(subida * COSTE_POR_EURO_DE_SUBIDA),
            desde: intervalo.desde || null,
            hasta: intervalo.hasta || null,
        });
    }

    return { subidas, atribuible: true, comparados };
};

/** Instantánea a partir del teamData de todos los equipos. */
export const construirInstantanea = (porEquipo) => {
    const snap = {};
    for (const [teamId, players] of porEquipo) {
        for (const pt of players || []) {
            const id = pt?.playerMaster?.id;
            if (id == null || !(pt.buyoutClause > 0)) continue;
            snap[String(id)] = {
                teamId: String(teamId),
                clause: pt.buyoutClause,
                marketValue: pt.playerMaster.marketValue ?? null,
                // El nombre viaja en la instantánea porque la comparación se
                // hace contra datos de otra sesión: si no, solo habría ids.
                name: pt.playerMaster.nickname || pt.playerMaster.name || null,
            };
        }
    }
    return snap;
};

/** Acumula el coste detectado por equipo sobre lo ya registrado. */
export const acumularCostes = (previos, subidas) => {
    const total = { ...(previos || {}) };
    for (const s of subidas) {
        total[s.teamId] = (total[s.teamId] || 0) + s.coste;
    }
    return total;
};

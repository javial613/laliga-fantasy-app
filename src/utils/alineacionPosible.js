/**
 * ¿Puede un equipo formar alineación? Y si no, ¿a quién habría que clausularle
 * para dejarlo sin poder hacerlo?
 *
 * Un manager que no puede completar una alineación válida no puntúa esa
 * jornada. Como las cláusulas se pagan sobre jugadores concretos, se puede
 * dejar a un rival sin equipo quitándole los de una posición escasa, aunque le
 * sobren jugadores en total: tener 17 no sirve de nada si solo quedan dos
 * centrocampistas.
 *
 * Las formaciones de pago NO cuentan: esta liga no las tiene. Eso cambia el
 * resultado en casos que de otro modo parecerían válidos —con 3 defensas y 3
 * centrocampistas la única salida sería 3·3·4, que es premium—, así que la
 * lista de abajo es la pieza clave de todo el cálculo.
 */

// [defensas, centrocampistas, delanteros]; más un portero en todas.
export const FORMACIONES = [
    [5, 3, 2],
    [4, 5, 1],
    [4, 4, 2],
    [4, 3, 3],
    [3, 5, 2],
    [3, 4, 3],
];

export const POSICIONES = { PORTERO: 1, DEFENSA: 2, MEDIO: 3, DELANTERO: 4 };

/** Reparto por posición de una lista de jugadores. */
export const contarPorPosicion = (jugadores) => {
    const cuenta = { porteros: 0, defensas: 0, medios: 0, delanteros: 0, otros: 0 };
    for (const j of jugadores || []) {
        switch (Number(j?.positionId)) {
            case POSICIONES.PORTERO: cuenta.porteros += 1; break;
            case POSICIONES.DEFENSA: cuenta.defensas += 1; break;
            case POSICIONES.MEDIO: cuenta.medios += 1; break;
            case POSICIONES.DELANTERO: cuenta.delanteros += 1; break;
            default: cuenta.otros += 1; break;
        }
    }
    return cuenta;
};

/** ¿Hay alguna formación no premium que encaje con estos efectivos? */
export const puedeAlinear = ({ porteros = 0, defensas = 0, medios = 0, delanteros = 0 } = {}) =>
    porteros >= 1
    && FORMACIONES.some(([d, m, f]) => defensas >= d && medios >= m && delanteros >= f);

/**
 * ¿Se le puede pagar la cláusula a tiempo?
 *
 * Con `limite` (el cierre de 24 h antes de la jornada) cuenta también quien
 * está protegido ahora pero se desbloquea antes de ese momento: para la
 * jornada que viene es igual de alcanzable. Sin `limite` se mira solo si ya
 * está abierta.
 */
export const esClausulable = (jugador, ahora = Date.now(), limite = null) => {
    if (!jugador?.clausula) return false;
    const fin = jugador.lockedUntil ? new Date(jugador.lockedUntil).getTime() : null;
    if (fin === null || Number.isNaN(fin)) return true;
    return fin <= (limite ?? ahora);
};

const CLAVES = ['porteros', 'defensas', 'medios', 'delanteros'];
const CLAVE_DE_POSICION = {
    [POSICIONES.PORTERO]: 'porteros',
    [POSICIONES.DEFENSA]: 'defensas',
    [POSICIONES.MEDIO]: 'medios',
    [POSICIONES.DELANTERO]: 'delanteros',
};

/**
 * Combinaciones de bajas (cuántas por posición) de un tamaño dado, sin pasarse
 * de los jugadores que realmente se pueden clausular en cada una.
 */
const repartos = (total, tope) => {
    const salida = [];
    for (let a = 0; a <= Math.min(total, tope.porteros); a += 1) {
        for (let b = 0; b <= Math.min(total - a, tope.defensas); b += 1) {
            for (let c = 0; c <= Math.min(total - a - b, tope.medios); c += 1) {
                const d = total - a - b - c;
                if (d >= 0 && d <= tope.delanteros) {
                    salida.push({ porteros: a, defensas: b, medios: c, delanteros: d });
                }
            }
        }
    }
    return salida;
};

/**
 * Analiza una plantilla.
 *
 * @param {Array<{playerId, nombre, positionId, clausula, lockedUntil}>} jugadores
 * @param {{ahora?:number, topeGasto?:number, limite?:number|null}} opciones -
 *   `limite` es el cierre de cláusulas (24 h antes de la jornada): con él se
 *   cuentan también los que se desbloquean antes de esa hora.
 * @returns {{
 *   total:number, porPosicion:Object, puedeAlinear:boolean,
 *   vulnerable:boolean, jugada:{jugadores:Array, coste:number}|null,
 *   clausulables:number
 * }}
 */
export const analizarPlantilla = (jugadores, { ahora = Date.now(), topeGasto = Infinity, limite = null } = {}) => {
    const lista = Array.isArray(jugadores) ? jugadores : [];
    const porPosicion = contarPorPosicion(lista);
    const alineable = puedeAlinear(porPosicion);

    // Candidatos por posición, de cláusula más barata a más cara: si hay que
    // llevarse dos centrocampistas, interesan los dos más baratos.
    const candidatos = { porteros: [], defensas: [], medios: [], delanteros: [] };
    for (const j of lista) {
        const clave = CLAVE_DE_POSICION[Number(j?.positionId)];
        if (clave && esClausulable(j, ahora, limite)) candidatos[clave].push(j);
    }
    for (const clave of CLAVES) candidatos[clave].sort((a, b) => a.clausula - b.clausula);

    const tope = CLAVES.reduce((acc, k) => ({ ...acc, [k]: candidatos[k].length }), {});
    const clausulables = CLAVES.reduce((n, k) => n + tope[k], 0);

    const vacio = {
        total: lista.length, porPosicion, puedeAlinear: alineable, clausulables,
        vulnerable: false, jugada: null,
    };
    // Si ya no puede alinear, no hay nada que provocar.
    if (!alineable || clausulables === 0) return vacio;

    // Se examinan TODAS las combinaciones, de cualquier tamaño, y gana la más
    // barata: a quien ataca lo que le limita es el dinero, no el número de
    // fichajes. Quedarse con la jugada más corta escondía amenazas reales
    // —una cláusula de 60 millones tapaba a tres de dos—. A igual precio se
    // prefiere la de menos jugadores, que depende menos de que el otro no
    // reaccione entre medias.
    let mejor = null;
    for (let tamano = 1; tamano <= clausulables; tamano += 1) {
        for (const reparto of repartos(tamano, tope)) {
            const quedan = CLAVES.reduce((acc, k) => ({ ...acc, [k]: porPosicion[k] - reparto[k] }), {});
            if (puedeAlinear(quedan)) continue;

            const elegidos = CLAVES.flatMap((k) => candidatos[k].slice(0, reparto[k]));
            const coste = elegidos.reduce((s, j) => s + (j.clausula || 0), 0);
            if (coste > topeGasto) continue;

            const mejorHastaAhora = !mejor
                || coste < mejor.coste
                || (coste === mejor.coste && elegidos.length < mejor.jugadores.length);
            if (mejorHastaAhora) mejor = { jugadores: elegidos, coste };
        }
    }

    if (!mejor) return vacio;
    return { ...vacio, vulnerable: true, jugada: mejor };
};

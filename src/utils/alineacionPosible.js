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

/** Un jugador se puede clausular si su protección no existe o ya venció. */
export const esClausulable = (jugador, ahora = Date.now()) => {
    if (!jugador?.clausula) return false;
    const fin = jugador.lockedUntil ? new Date(jugador.lockedUntil).getTime() : null;
    if (fin === null || Number.isNaN(fin)) return true;
    return fin <= ahora;
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
 * @param {{ahora?:number, topeGasto?:number}} opciones
 * @returns {{
 *   total:number, porPosicion:Object, puedeAlinear:boolean,
 *   vulnerable:boolean, jugada:{jugadores:Array, coste:number}|null,
 *   clausulables:number
 * }}
 */
export const analizarPlantilla = (jugadores, { ahora = Date.now(), topeGasto = Infinity } = {}) => {
    const lista = Array.isArray(jugadores) ? jugadores : [];
    const porPosicion = contarPorPosicion(lista);
    const alineable = puedeAlinear(porPosicion);

    // Candidatos por posición, de cláusula más barata a más cara: si hay que
    // llevarse dos centrocampistas, interesan los dos más baratos.
    const candidatos = { porteros: [], defensas: [], medios: [], delanteros: [] };
    for (const j of lista) {
        const clave = CLAVE_DE_POSICION[Number(j?.positionId)];
        if (clave && esClausulable(j, ahora)) candidatos[clave].push(j);
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

    for (let tamano = 1; tamano <= clausulables; tamano += 1) {
        let mejor = null;
        for (const reparto of repartos(tamano, tope)) {
            const quedan = CLAVES.reduce((acc, k) => ({ ...acc, [k]: porPosicion[k] - reparto[k] }), {});
            if (puedeAlinear(quedan)) continue;

            const elegidos = CLAVES.flatMap((k) => candidatos[k].slice(0, reparto[k]));
            const coste = elegidos.reduce((s, j) => s + (j.clausula || 0), 0);
            if (!mejor || coste < mejor.coste) mejor = { jugadores: elegidos, coste };
        }
        // Se recorre por número de fichajes: la jugada más corta es la que
        // menos depende de que el rival no reaccione entre medias.
        if (mejor) {
            if (mejor.coste > topeGasto) return { ...vacio, vulnerable: false, jugada: null };
            return { ...vacio, vulnerable: true, jugada: mejor };
        }
    }
    return vacio;
};

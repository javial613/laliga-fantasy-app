/**
 * Venta automática de los fichajes.
 *
 * Se detecta comparando la plantilla con la de la comprobación anterior: un
 * jugador que antes no estaba es un fichaje, venga de donde venga (cláusula
 * pagada, puja ganada de madrugada u oferta aceptada por otro manager).
 *
 * La primera comprobación NO vende nada: sin foto previa, toda la plantilla
 * parecería recién fichada y se pondría entera en el mercado.
 */

// Más de esto en una sola tanda no es un día movido, es un error: una foto
// previa perdida, un cambio de liga o un fallo al leer la plantilla. Ante la
// duda se prefiere no vender y avisar.
export const MAX_POR_TANDA = 3;

/** Ids de la plantilla, como texto, para poder compararlos sin sorpresas. */
export const idsDePlantilla = (jugadores) =>
    (Array.isArray(jugadores) ? jugadores : [])
        .map((j) => j?.playerMasterId ?? j?.playerId ?? null)
        .filter((id) => id != null)
        .map(String);

/**
 * @param {string[]|null} anteriores - ids de la comprobación previa; null la
 *   primera vez, que solo sirve para tomar la foto inicial.
 * @param {Array} actuales - plantilla actual ya cruzada con el mercado
 * @returns {{nuevos:Array, esPrimeraVez:boolean, demasiados:boolean}}
 */
export const detectarFichajes = (anteriores, actuales) => {
    const lista = Array.isArray(actuales) ? actuales : [];
    if (!Array.isArray(anteriores)) {
        return { nuevos: [], esPrimeraVez: true, demasiados: false };
    }
    const conocidos = new Set(anteriores.map(String));
    const nuevos = lista.filter((j) => {
        const id = j?.playerMasterId ?? j?.playerId;
        return id != null && !conocidos.has(String(id));
    });
    return {
        nuevos,
        esPrimeraVez: false,
        demasiados: nuevos.length > MAX_POR_TANDA,
    };
};

/** De los fichajes, los que hay que anunciar: los que no están ya en venta. */
export const aPonerEnVenta = (nuevos) =>
    (nuevos || []).filter((j) => j && !j.enVenta && (j.valor || 0) > 0);

/**
 * Lógica de la sección Venta: cruzar la plantilla con el mercado y decidir
 * qué hacer con cada jugador.
 *
 * Va aparte de la pantalla porque es donde está el riesgo: poner o quitar
 * del mercado en bloque toca muchos jugadores de una vez, y una confusión
 * entre el identificador del jugador y el del anuncio deja ventas a medias.
 */

/** Identificador que la API espera al PONER a la venta (el de la plantilla). */
export const idDePlantilla = (entrada) =>
    entrada?.playerTeamId ?? entrada?.id ?? null;

/** Identificador del jugador en sí, el que comparten plantilla y mercado. */
export const idDeJugador = (entrada) => entrada?.playerMaster?.id ?? null;

/**
 * Busca el anuncio de un jugador en el mercado.
 * El identificador que hace falta para RETIRAR es el del anuncio, no el del
 * jugador: confundirlos borra el anuncio de otro o no borra nada.
 */
export const buscarAnuncio = (anuncios, playerMasterId) => {
    if (!Array.isArray(anuncios) || playerMasterId == null) return null;
    return anuncios.find((a) => (
        a?.playerMaster?.id === playerMasterId
        || a?.playerTeam?.playerTeamId === playerMasterId
        || a?.playerTeam?.id === playerMasterId
    )) || null;
};

/**
 * Cruza plantilla y mercado.
 * @returns {Array<{playerTeamId, playerMasterId, nombre, posicionId, valor,
 *   enVenta: boolean, marketId: (string|number|null), precioActual: number|null,
 *   escudo: string|null, imagen: string|null}>}
 */
export const cruzarPlantillaConMercado = (plantilla, anuncios) => {
    if (!Array.isArray(plantilla)) return [];
    return plantilla.map((entrada) => {
        const jugador = entrada?.playerMaster || {};
        const playerMasterId = idDeJugador(entrada);
        const anuncio = buscarAnuncio(anuncios, playerMasterId);
        return {
            playerTeamId: idDePlantilla(entrada),
            playerMasterId,
            nombre: jugador.nickname || jugador.name || 'Jugador',
            posicionId: jugador.positionId ?? null,
            valor: jugador.marketValue ?? 0,
            escudo: jugador.team?.badgeColor || null,
            imagen: jugador.images?.transparent?.['256x256'] || null,
            enVenta: !!anuncio,
            marketId: anuncio ? (anuncio.id ?? null) : null,
            precioActual: anuncio ? (anuncio.salePrice ?? null) : null,
        };
    });
};

/**
 * Precio de salida: el valor de mercado del jugador, tal cual.
 * Devuelve 0 si no hay valor utilizable, para que quien llame no intente
 * anunciar a un precio inventado.
 */
export const precioDeVenta = (valor) => {
    const base = Number(valor);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return Math.round(base);
};

/**
 * Reparte una selección entre lo que hay que poner y lo que hay que quitar.
 * Un jugador ya anunciado no se vuelve a poner —la API lo rechazaría— y uno
 * que no está en el mercado no se puede retirar.
 */
export const repartirAcciones = (jugadores, seleccion) => {
    const elegidos = jugadores.filter((j) => seleccion.has(j.playerMasterId));
    return {
        aPoner: elegidos.filter((j) => !j.enVenta),
        aQuitar: elegidos.filter((j) => j.enVenta && j.marketId != null),
        // En venta pero sin anuncio localizable: no se toca y se avisa, en
        // vez de fallar en silencio.
        sinAnuncio: elegidos.filter((j) => j.enVenta && j.marketId == null),
    };
};

/**
 * Ejecuta una tanda de operaciones, una detrás de otra.
 *
 * En serie a propósito: son escrituras sobre el mismo mercado y lanzarlas a
 * la vez provoca rechazos del servidor. Un fallo suelto no corta la tanda;
 * se informa al final de qué salió y qué no.
 *
 * @param {Array} elementos
 * @param {(elemento) => Promise<void>} accion
 * @param {(hechos:number, total:number, elemento:Object) => void} [alAvanzar]
 */
export const ejecutarEnSerie = async (elementos, accion, alAvanzar) => {
    const fallos = [];
    let hechos = 0;
    for (const elemento of elementos) {
        try {
            await accion(elemento);
        } catch (error) {
            fallos.push({ elemento, error: error?.message || 'Error desconocido' });
        }
        hechos += 1;
        alAvanzar?.(hechos, elementos.length, elemento);
    }
    return { total: elementos.length, fallos, exitos: elementos.length - fallos.length };
};

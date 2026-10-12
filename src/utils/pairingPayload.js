/**
 * Formato del emparejamiento entre el Mac y el móvil.
 *
 * El QR lleva una sesión *nueva e independiente* (ver PairPhone): no se
 * comparte la del Mac porque el proveedor rota el refresh token en cada uso y
 * los dos aparatos se irían echando el uno al otro.
 *
 * Solo viaja el refresh token, no la sesión entera: los tres tokens juntos
 * pasan de 4.500 caracteres y no caben en un QR. Con el refresh, el móvil
 * pide los suyos nada más abrirse.
 *
 * El payload va en la parte del enlace que sigue a `#`, que los navegadores
 * NO envían al servidor: así la sesión no queda registrada en ningún log.
 */

const VERSION = 1;

// Base64 apto para URL: sin +, / ni = que haya que escapar. El paso por
// encodeURIComponent convierte el texto a UTF-8 antes de codificarlo, que es
// lo que btoa necesita para no atragantarse con acentos y eñes.
const aBase64Url = (texto) => {
    const utf8 = encodeURIComponent(texto)
        .replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const deBase64Url = (texto) => {
    const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binario = atob(relleno);
    const porcentajes = Array.from(binario)
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('');
    return decodeURIComponent(porcentajes);
};

/**
 * @param {{refreshToken:string, clientId?:string, leagueId?:string|number, leagueName?:string}} datos
 * @returns {string} texto para meter en el QR, tras el # del enlace
 */
export const codificarEmparejamiento = ({ refreshToken, clientId, leagueId, leagueName }) => {
    if (!refreshToken || typeof refreshToken !== 'string') {
        throw new Error('Falta el refresh token');
    }
    // Claves cortas: cada carácter cuenta para que el QR no se vuelva ilegible.
    const payload = { v: VERSION, rt: refreshToken };
    if (clientId) payload.ci = clientId;
    if (leagueId != null && leagueId !== '') payload.li = String(leagueId);
    if (leagueName) payload.ln = leagueName;
    return aBase64Url(JSON.stringify(payload));
};

/**
 * @returns {{refreshToken:string, clientId:string|null, leagueId:string|null, leagueName:string|null}|null}
 *   null si el texto no es un emparejamiento válido; nunca lanza, porque la
 *   entrada viene de la barra de direcciones y puede ser cualquier cosa.
 */
export const descodificarEmparejamiento = (texto) => {
    if (!texto || typeof texto !== 'string') return null;
    try {
        const payload = JSON.parse(deBase64Url(texto));
        if (!payload || payload.v !== VERSION) return null;
        if (!payload.rt || typeof payload.rt !== 'string') return null;
        return {
            refreshToken: payload.rt,
            clientId: payload.ci || null,
            leagueId: payload.li || null,
            leagueName: payload.ln || null,
        };
    } catch (error) {
        return null;
    }
};

/** Saca el emparejamiento de un hash tipo "#pair=XXXX". */
export const leerEmparejamientoDeHash = (hash) => {
    if (typeof hash !== 'string') return null;
    const limpio = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(limpio);
    const valor = params.get('pair');
    return valor ? descodificarEmparejamiento(valor) : null;
};

export const construirEnlaceEmparejamiento = (urlBase, datos) =>
    `${String(urlBase).replace(/\/$/, '')}/#pair=${codificarEmparejamiento(datos)}`;

// ---------------------------------------------------------------------------
// Vuelta del login hecho en el navegador del sistema.
//
// Apple rechaza el inicio de sesión desde ventanas empotradas ("Failed to
// verify your identity"), así que el login se abre en el navegador de verdad.
// LaLiga devuelve al terminar a authredirect://com.lfp.laligafantasy?code=…,
// que macOS entrega a la app como un evento open-url. Este módulo es el punto
// de encuentro entre ese evento (main.js) y quien espera el código
// (ipc-handlers.js).
// ---------------------------------------------------------------------------

// Quien está esperando ahora mismo: { redirectUri, resolve, timer }.
let pendiente = null;

// La redirección puede llegar antes de que nadie la espere (p. ej. si macOS
// arranca la app al abrir el enlace), así que se guarda la última junto con
// el momento en que llegó: un código caducado o de otro intento no debe
// colarse en un login posterior, que fallaría con un state que no cuadra.
let urlEnEspera = null;
let urlEnEsperaDesde = 0;
const VALIDEZ_URL_GUARDADA = 2 * 60 * 1000;

const esUrlDeVuelta = (url, redirectUri) =>
    typeof url === 'string' && typeof redirectUri === 'string'
    && redirectUri !== '' && url.startsWith(redirectUri);

// Solo se guarda lo que es nuestro y trae respuesta: un enlace suelto sin
// código se quedaría encolado y haría fallar el siguiente login de verdad, y
// una URL de otro esquema no es cosa nuestra.
const ESQUEMA = 'authredirect:';
const mereceGuardarse = (url) =>
    String(url).startsWith(ESQUEMA) && /[?&](code|error)=/.test(String(url));

/**
 * Espera la vuelta del navegador.
 * @returns {Promise<{success:boolean, url?:string, error?:string}>}
 */
function esperarRedireccion({ redirectUri, timeoutMs = 10 * 60 * 1000 }) {
    cancelarEspera({ success: false, error: 'Se inició otro intento de login' });

    const guardadaReciente = Date.now() - urlEnEsperaDesde < VALIDEZ_URL_GUARDADA;
    if (guardadaReciente && esUrlDeVuelta(urlEnEspera, redirectUri)) {
        const url = urlEnEspera;
        urlEnEspera = null;
        return Promise.resolve({ success: true, url });
    }
    urlEnEspera = null;

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            pendiente = null;
            resolve({ success: false, error: 'Se agotó el tiempo de espera del login' });
        }, timeoutMs);
        pendiente = { redirectUri, resolve, timer };
    });
}

/**
 * Entrega una URL recibida por el sistema.
 * @returns {boolean} true si alguien la estaba esperando o se ha guardado.
 */
function entregarUrl(url) {
    if (typeof url !== 'string') return false;

    if (pendiente && esUrlDeVuelta(url, pendiente.redirectUri)) {
        const { resolve, timer } = pendiente;
        pendiente = null;
        clearTimeout(timer);
        resolve({ success: true, url });
        return true;
    }

    if (mereceGuardarse(url)) {
        urlEnEspera = url;
        urlEnEsperaDesde = Date.now();
        return true;
    }
    return false;
}

/** Resuelve la espera en curso, si la hay (login cancelado, app cerrada…). */
function cancelarEspera(resultado = { success: false, cancelled: true }) {
    if (!pendiente) return;
    const { resolve, timer } = pendiente;
    pendiente = null;
    clearTimeout(timer);
    resolve(resultado);
}

module.exports = { esperarRedireccion, entregarUrl, cancelarEspera };

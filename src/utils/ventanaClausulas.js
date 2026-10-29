/**
 * Hasta cuándo se pueden pagar cláusulas.
 *
 * La liga las cierra 24 horas antes de que empiece la jornada. Eso manda
 * sobre cualquier otro cálculo: un jugador cuya protección vence después del
 * cierre es intocable para esa jornada por mucho que la cláusula se abra, y
 * uno protegido ahora mismo sí cuenta si se desbloquea antes.
 */

export const HORAS_DE_CIERRE = 24;
const CIERRE_MS = HORAS_DE_CIERRE * 60 * 60 * 1000;

const comoInstante = (fecha) => {
    if (fecha == null) return null;
    const t = new Date(fecha).getTime();
    return Number.isNaN(t) ? null : t;
};

/**
 * Próximo cierre a partir de ahora.
 *
 * Si el de la jornada en curso ya pasó, el que cuenta es el de la siguiente:
 * durante esas 24 horas no se puede clausular a nadie, y lo siguiente que
 * puede ocurrir es la jornada que viene.
 *
 * @param {string|number|Date} aperturaActual - inicio de la jornada en curso
 * @param {string|number|Date} aperturaSiguiente - inicio de la siguiente
 * @param {number} ahora
 * @returns {{limite:number|null, apertura:number|null, cerradaLaEnCurso:boolean}}
 */
export const calcularVentanaClausulas = (aperturaActual, aperturaSiguiente, ahora = Date.now()) => {
    const actual = comoInstante(aperturaActual);
    const siguiente = comoInstante(aperturaSiguiente);

    if (actual != null && ahora <= actual - CIERRE_MS) {
        return { limite: actual - CIERRE_MS, apertura: actual, cerradaLaEnCurso: false };
    }
    if (siguiente != null) {
        return { limite: siguiente - CIERRE_MS, apertura: siguiente, cerradaLaEnCurso: actual != null };
    }
    // Sin fechas no se inventa un plazo: se devuelve null y quien llame decide
    // (el análisis cae entonces al comportamiento de "ahora mismo").
    return { limite: null, apertura: actual, cerradaLaEnCurso: false };
};

/**
 * Texto corto del plazo, para mostrarlo junto a los avisos.
 *
 * La hora va siempre en peninsular, no en la del aparato: la liga funciona en
 * esa zona y el resto de la app ya la usa (ver clauseTracker). Con un
 * ordenador configurado en otro huso, la hora local sería engañosa.
 */
export const describirLimite = (limite, ahora = Date.now()) => {
    if (limite == null) return null;
    const falta = limite - ahora;
    const fecha = `${new Date(limite).toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })} (hora peninsular)`;
    if (falta <= 0) return `cerrado desde el ${fecha}`;
    const horas = Math.floor(falta / 3600000);
    if (horas < 1) return `hasta el ${fecha} (menos de 1 hora)`;
    if (horas < 48) return `hasta el ${fecha} (quedan ${horas} h)`;
    return `hasta el ${fecha} (quedan ${Math.floor(horas / 24)} días)`;
};

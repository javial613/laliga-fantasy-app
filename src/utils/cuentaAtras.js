/**
 * Cuenta atrás con precisión de segundos.
 *
 * El mercado mostraba "1h" durante casi una hora entera, justo cuando saber
 * si quedan cincuenta minutos o cuarenta segundos es lo que decide si pujas
 * ahora o te lo piensas.
 */

/**
 * @param {number} ms - milisegundos restantes
 * @returns {string} "2d 5h", "3h 07m", "12m 05s", "41s" o "expirado"
 */
export const formatearRestante = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return 'expirado';

    const total = Math.floor(ms / 1000);
    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;
    const dos = (n) => String(n).padStart(2, '0');

    // A partir de un día los segundos sobran; por debajo de una hora son lo
    // único que importa.
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${dos(minutos)}m`;
    if (minutos > 0) return `${minutos}m ${dos(segundos)}s`;
    return `${segundos}s`;
};

/** Cada cuánto conviene repintar según lo que quede: sin gastar de más. */
export const intervaloDeRefresco = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return null;
    if (ms < 60 * 60 * 1000) return 1000;        // bajo una hora, al segundo
    if (ms < 24 * 60 * 60 * 1000) return 30000;  // bajo un día, cada medio minuto
    return 300000;
};

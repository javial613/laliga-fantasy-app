/**
 * Correcciones manuales del saldo calculado.
 *
 * El saldo de cada manager se reconstruye desde el histórico de actividad, pero
 * hay dinero que ese histórico no publica. El caso conocido son las subidas de
 * cláusula: la app las detecta comparando instantáneas (ver clauseTracker),
 * así que solo ve las que ocurren desde que empezó a vigilarlas. Lo gastado
 * antes es irrecuperable por cálculo.
 *
 * Estas entradas cubren ese hueco con una estimación introducida a mano. Son
 * deliberadamente explícitas y visibles: aparecen etiquetadas en el desglose de
 * la pantalla de Equipos para que se sepa que ese saldo lleva una corrección
 * manual y no salga de los datos.
 *
 * La clave es el nombre del manager, en minúsculas. Para retirar una
 * corrección basta con borrar su línea.
 *
 * SIGNO: `importe` se **resta** del saldo calculado. Un importe positivo baja
 * el saldo (dinero gastado que el histórico no publica); uno negativo lo sube
 * (dinero ingresado que tampoco aparece).
 */
const AJUSTES = {
    // Gasto en subidas de cláusula que el vigilante no ha detectado, aportado
    // por el usuario de la liga: 2M previos al seguimiento + 25M añadidos el
    // 13-09-2026. Va aparte de lo que detecta el bot, que se resta por su lado.
    'juanitoooo21': { importe: 27000000, motivo: 'subidas de cláusula no detectadas (2M previas al seguimiento + 25M)' },
    // Importe negativo: suma al saldo. Corrección aportada por el usuario.
    'yaguettou': { importe: -2700000, motivo: 'corrección manual del propio usuario' },
};

const normalizar = (nombre) =>
    typeof nombre === 'string' ? nombre.trim().toLowerCase() : '';

/** @returns {{importe:number, motivo:string}|null} */
export const getAjusteManual = (managerName) => {
    const clave = normalizar(managerName);
    return clave && AJUSTES[clave] ? AJUSTES[clave] : null;
};

export default AJUSTES;

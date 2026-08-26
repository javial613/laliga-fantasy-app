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
 */
const AJUSTES = {
    // Gasto estimado en subidas de cláusula anteriores a que la app las
    // vigilara. Cifra aportada por el usuario de la liga.
    'juanitoooo21': { importe: 2000000, motivo: 'subidas de cláusula previas al seguimiento' },
};

const normalizar = (nombre) =>
    typeof nombre === 'string' ? nombre.trim().toLowerCase() : '';

/** @returns {{importe:number, motivo:string}|null} */
export const getAjusteManual = (managerName) => {
    const clave = normalizar(managerName);
    return clave && AJUSTES[clave] ? AJUSTES[clave] : null;
};

export default AJUSTES;

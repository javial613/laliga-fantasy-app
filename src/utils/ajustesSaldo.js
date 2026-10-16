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
 * Van agrupadas por liga: una corrección solo tiene sentido en la liga donde
 * se gastó ese dinero. Sin agrupar, al entrar en otra liga se aplicarían a
 * cualquier manager que se llamara igual y el saldo saldría mal.
 *
 * Dentro de cada liga la clave es el nombre del manager, en minúsculas. Para
 * retirar una corrección basta con borrar su línea.
 *
 * SIGNO: `importe` se **resta** del saldo calculado. Un importe positivo baja
 * el saldo (dinero gastado que el histórico no publica); uno negativo lo sube
 * (dinero ingresado que tampoco aparece).
 *
 * Una entrada puede además llevar `porDia` y `desde`, para lo que se repite a
 * diario y tampoco aparece en el histórico —por ejemplo el dinero que da la
 * liga por ver anuncios—. Se cuenta el día de inicio incluido, así que el
 * primer día ya suma.
 */
const AJUSTES = {
    // Liga 017842199.
    '017842199': {
        // Gasto en subidas de cláusula que el vigilante no ha detectado, aportado
        // por el usuario de la liga: 2M previos al seguimiento + 25M añadidos el
        // 13-09-2026. Va aparte de lo que detecta el bot, que se resta por su lado.
        'juanitoooo21': { importe: 27000000, motivo: 'subidas de cláusula no detectadas (2M previas al seguimiento + 25M)' },
        // Importe negativo: suma al saldo. Corrección aportada por el usuario.
        'yaguettou': { importe: -2700000, motivo: 'corrección manual del propio usuario' },
    },
    // Liga 018592924 (Xixarito).
    '018592924': {
        // Positivo resta (la subida de cláusula que el vigilante no vio el
        // 06-10-2026); el porDia negativo suma lo que la liga le da a diario.
        'juanitoooo21': {
            importe: 2500000,
            motivo: 'subida de cláusula no detectada, menos los ingresos diarios',
            porDia: -50000,
            desde: '2026-10-16',
        },
        // Ve los anuncios que dan 100.000 al día. El millón de salida cubre
        // los que ya llevaba vistos antes de empezar a contarlos.
        'perogu': {
            importe: -1000000,
            motivo: 'ingresos por ver anuncios',
            porDia: -100000,
            desde: '2026-10-16',
        },
    },
};

const normalizar = (nombre) =>
    typeof nombre === 'string' ? nombre.trim().toLowerCase() : '';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días transcurridos desde `desde`, contando ese mismo día. 0 si aún no ha llegado. */
export const diasDesde = (desde, ahora = new Date()) => {
    const inicio = new Date(`${desde}T00:00:00Z`);
    if (Number.isNaN(inicio.getTime())) return 0;
    const hoy = new Date(ahora);
    if (Number.isNaN(hoy.getTime())) return 0;
    const diferencia = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - inicio.getTime();
    if (diferencia < 0) return 0;
    return Math.floor(diferencia / DIA_MS) + 1;
};

/**
 * Motivo con el cálculo a la vista. En el desglose de Equipos se ve un
 * importe que cambia solo cada día; sin decir de dónde sale, parecería un
 * error de la aplicación.
 */
const motivoResuelto = (entrada, dias) => {
    if (!entrada.porDia || !entrada.desde) return entrada.motivo;
    const diario = Math.abs(Number(entrada.porDia)).toLocaleString('es-ES');
    return `${entrada.motivo}: ${diario}€/día × ${dias} día${dias === 1 ? '' : 's'}`;
};

/** Importe total de una entrada: lo fijo más lo que se acumula por días. */
const importeTotal = (entrada, ahora) => {
    const fijo = Number(entrada.importe) || 0;
    if (!entrada.porDia || !entrada.desde) return fijo;
    return fijo + (Number(entrada.porDia) || 0) * diasDesde(entrada.desde, ahora);
};

/**
 * @param {string} managerName
 * @param {string|number} leagueId - sin liga no se aplica ninguna corrección:
 *   es preferible un saldo sin corregir a uno corregido con datos de otra liga.
 * @param {Date} [ahora] - para poder fijar la fecha en las pruebas.
 * @returns {{importe:number, motivo:string}|null} importe ya resuelto, con la
 *   parte diaria incluida.
 */
export const getAjusteManual = (managerName, leagueId, ahora = new Date()) => {
    if (leagueId === null || leagueId === undefined || leagueId === '') return null;
    const deLaLiga = AJUSTES[String(leagueId)];
    if (!deLaLiga) return null;
    const clave = normalizar(managerName);
    const entrada = clave ? deLaLiga[clave] : null;
    if (!entrada) return null;
    const dias = entrada.porDia && entrada.desde ? diasDesde(entrada.desde, ahora) : 0;
    return {
        ...entrada,
        importe: importeTotal(entrada, ahora),
        motivo: motivoResuelto(entrada, dias),
    };
};

export default AJUSTES;

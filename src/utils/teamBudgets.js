/**
 * Reconstrucción del saldo de cada manager a partir del histórico de actividad.
 *
 * Todos parten del mismo presupuesto inicial y, desde ahí, el feed de la liga
 * describe cada movimiento de dinero. Sumando y restando en orden se llega al
 * saldo actual sin necesidad de un endpoint que lo exponga — la API solo
 * devuelve el saldo del equipo propio.
 *
 * activityTypeId (ver activityUtils):
 *   1  compró          gasto de user1  (si hay user2, es el vendedor: ingreso)
 *   31 fichó           idem
 *   32 clausuló        gasto de user1  (user2 = dueño anterior: ingreso)
 *   33 vendió          ingreso de user1 (si hay user2, es el comprador: gasto)
 *   6  ganancia jornada ingreso de user1
 *   4  blindó          coste no reflejado en `amount` de forma fiable → se ignora
 *   7  alineación incorrecta / 9 nuevo miembro → sin efecto en caja
 *
 * La cifra resultante es una ESTIMACIÓN: depende de que el histórico llegue
 * completo hasta el inicio de la liga y de que estos sean todos los tipos que
 * mueven dinero. Por eso `buildBudgetLedger` devuelve también los tipos que ha
 * ignorado y si el histórico estaba completo, para que la UI pueda avisar en
 * vez de presentar un número inventado como si fuera exacto.
 */

export const STARTING_BUDGET = 100000000; // 100M

const EXPENSE_TYPES = new Set([1, 31, 32]);
const INCOME_TYPES = new Set([33]);
const EARNINGS_TYPE = 6;
// Tipos conocidos que no mueven caja: no deben contar como "desconocidos".
const NEUTRAL_TYPES = new Set([4, 7, 9]);

const idOf = (value) => (value == null ? null : String(value));

const normalizeName = (value) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

/**
 * Manager de un evento. La API no siempre trae `userNId`: unos eventos vienen
 * solo con `userNName` y otros ni eso, con el nombre embebido en la frase de
 * `description`. La página de Actividad ya contempla las tres formas; el
 * cálculo de saldos tiene que hacer lo mismo o descartaría movimientos reales
 * en silencio, que es justo lo que descuadra el resultado.
 */
const resolveManager = (item, slot, managerIdByName) => {
    const byId = idOf(slot === 1 ? item.user1Id : item.user2Id);
    if (byId) return byId;

    const name = normalizeName(slot === 1 ? item.user1Name : item.user2Name);
    if (name && managerIdByName?.has(name)) return managerIdByName.get(name);

    if (slot === 1 && typeof item.description === 'string') {
        const match = item.description.match(/^(.+?) ha /);
        const fromText = normalizeName(match?.[1]);
        if (fromText && managerIdByName?.has(fromText)) return managerIdByName.get(fromText);
    }

    return null;
};

/**
 * Clave de transacción para no contar dos veces el mismo traspaso si el feed
 * lo publica desde los dos lados ("A compró a B" y "B vendió a A"). Los dos
 * managers van ordenados para que ambas variantes generen la misma clave.
 */
const transactionKey = (playerId, amount, a, b) =>
  [playerId ?? 'sin-jugador', amount, ...[a, b].filter(Boolean).sort()].join('|');

export const buildBudgetLedger = (items, options = {}) => {
    const {
        startingBudget = STARTING_BUDGET,
        historyComplete = true,
        traceManagerId = null,
        managerIdByName = null,
    } = options;

    // Desglose por tipo de evento para un manager concreto. Sirve para
    // contrastar el cálculo contra un saldo real conocido y ver en qué cubo
    // está el error, en vez de tener que adivinarlo.
    const traceId = traceManagerId == null ? null : String(traceManagerId);
    const trace = traceId ? new Map() : null;
    const recordTrace = (type, role, delta) => {
        if (!trace) return;
        if (!trace.has(type)) {
            trace.set(type, { comoUser1: 0, sumaUser1: 0, comoUser2: 0, sumaUser2: 0 });
        }
        const row = trace.get(type);
        if (role === 1) { row.comoUser1 += 1; row.sumaUser1 += delta; }
        else { row.comoUser2 += 1; row.sumaUser2 += delta; }
    };

    const balances = new Map();
    const ignoredTypes = new Map();
    const seenTransactions = new Set();
    let applied = 0;
    let duplicates = 0;
    // Motivos por los que un evento no se aplica: sirve para que el diagnóstico
    // diga qué se está perdiendo en vez de dejar un descuadre sin explicación.
    const skipped = { sinImporte: 0, sinManager: 0, tipoDesconocido: 0 };
    // Registro evento a evento de cómo se ha tratado cada movimiento. Es lo que
    // permite exportar un informe y contrastarlo contra la realidad línea a
    // línea, en vez de discutir sobre un total que no cuadra.
    const audit = [];
    const logAudit = (item, type, user1, user2, delta1, delta2, disposicion) => {
        audit.push({
            item, // referencia al evento original, para resolver nombres fuera
            fecha: item.createdAt || item.timestamp || null,
            tipo: type,
            user1, user2,
            user1Name: item.user1Name || null,
            user2Name: item.user2Name || null,
            playerId: idOf(item.playerMasterId ?? item.playerId),
            playerName: item.playerName || item.playerMaster?.nickname || item.playerMaster?.name || null,
            importe: Math.abs(Number(item.amount) || 0),
            delta1, delta2,
            disposicion,
            description: item.description || null,
        });
    };

    const move = (managerId, delta) => {
        if (!managerId || !delta) return;
        balances.set(managerId, (balances.get(managerId) || 0) + delta);
    };

    for (const item of Array.isArray(items) ? items : []) {
        if (!item) continue;
        const type = item.activityTypeId;
        // Los tipos neutros se registran igualmente: si alguno resultara mover
        // dinero, en el informe se verá que estaba ahí y se ignoró.
        const amount = Math.abs(Number(item.amount) || 0);
        const user1 = resolveManager(item, 1, managerIdByName);
        const user2 = resolveManager(item, 2, managerIdByName);

        if (NEUTRAL_TYPES.has(type)) {
            logAudit(item, type, resolveManager(item, 1, managerIdByName),
                     resolveManager(item, 2, managerIdByName), 0, 0, 'sin efecto en caja');
            continue;
        }

        const isExpense = EXPENSE_TYPES.has(type);
        const isIncome = INCOME_TYPES.has(type);
        const isEarnings = type === EARNINGS_TYPE;

        if (!isExpense && !isIncome && !isEarnings) {
            ignoredTypes.set(type, (ignoredTypes.get(type) || 0) + 1);
            skipped.tipoDesconocido += 1;
            logAudit(item, type, user1, user2, 0, 0, 'tipo no contemplado');
            continue;
        }
        if (!amount) {
            skipped.sinImporte += 1;
            logAudit(item, type, user1, user2, 0, 0, 'sin importe');
            continue;
        }
        if (!user1) {
            skipped.sinManager += 1;
            logAudit(item, type, user1, user2, 0, 0, 'manager no reconocido');
            continue;
        }

        if (isEarnings) {
            move(user1, amount);
            if (user1 === traceId) recordTrace(type, 1, amount);
            logAudit(item, type, user1, user2, amount, 0, 'aplicado');
            applied += 1;
            continue;
        }

        const key = transactionKey(idOf(item.playerMasterId ?? item.playerId), amount, user1, user2);
        if (seenTransactions.has(key)) {
            duplicates += 1;
            logAudit(item, type, user1, user2, 0, 0, 'duplicado descartado');
            continue;
        }
        seenTransactions.add(key);

        const sign = isExpense ? -1 : 1;
        move(user1, sign * amount);
        move(user2, -sign * amount); // la contraparte recibe el movimiento inverso
        if (user1 === traceId) recordTrace(type, 1, sign * amount);
        if (user2 === traceId) recordTrace(type, 2, -sign * amount);
        logAudit(item, type, user1, user2, sign * amount, user2 ? -sign * amount : 0, 'aplicado');
        applied += 1;
    }

    // El saldo inicial se suma al final: así los managers sin un solo
    // movimiento también aparecen con su presupuesto de partida.
    const result = new Map();
    for (const [managerId, delta] of balances) {
        result.set(managerId, startingBudget + delta);
    }

    return {
        balances: result,
        applied,
        duplicates,
        ignoredTypes,
        historyComplete,
        startingBudget,
        skipped,
        audit,
        trace,
        totalItems: Array.isArray(items) ? items.length : 0,
    };
};

/**
 * Saldo de un manager. Devuelve el presupuesto inicial si no tiene movimientos
 * (liga recién empezada), y `undefined` si no hay ledger todavía.
 */
export const getManagerBalance = (ledger, managerId) => {
    if (!ledger?.balances) return undefined;
    const id = idOf(managerId);
    if (!id) return undefined;
    return ledger.balances.has(id) ? ledger.balances.get(id) : ledger.startingBudget;
};

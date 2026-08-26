import { buildBudgetLedger, getManagerBalance, STARTING_BUDGET } from './teamBudgets';

const M = (n) => n * 1000000;
const compra = (u1, amount, playerId, u2) => ({ activityTypeId: 1, amount, user1Id: u1, user2Id: u2, playerMasterId: playerId });
const venta  = (u1, amount, playerId, u2) => ({ activityTypeId: 33, amount, user1Id: u1, user2Id: u2, playerMasterId: playerId });
const clausula = (u1, amount, playerId, u2) => ({ activityTypeId: 32, amount, user1Id: u1, user2Id: u2, playerMasterId: playerId });
const jornada = (u1, amount) => ({ activityTypeId: 6, amount, user1Id: u1 });

describe('buildBudgetLedger', () => {
    test('una compra al mercado descuenta del comprador y no abona a nadie', () => {
        const l = buildBudgetLedger([compra('A', M(20), 'p1')]);

        expect(getManagerBalance(l, 'A')).toBe(M(80));
        expect(l.applied).toBe(1);
    });

    test('una venta al mercado abona al vendedor', () => {
        const l = buildBudgetLedger([venta('A', M(15), 'p1')]);

        expect(getManagerBalance(l, 'A')).toBe(M(115));
    });

    test('un traspaso entre managers mueve dinero en ambos sentidos', () => {
        const l = buildBudgetLedger([compra('A', M(30), 'p1', 'B')]);

        expect(getManagerBalance(l, 'A')).toBe(M(70));
        expect(getManagerBalance(l, 'B')).toBe(M(130));
    });

    test('una cláusula paga el dueño anterior', () => {
        const l = buildBudgetLedger([clausula('A', M(50), 'p1', 'B')]);

        expect(getManagerBalance(l, 'A')).toBe(M(50));
        expect(getManagerBalance(l, 'B')).toBe(M(150));
    });

    test('la ganancia por jornada suma', () => {
        const l = buildBudgetLedger([jornada('A', M(2)), jornada('A', M(3))]);

        expect(getManagerBalance(l, 'A')).toBe(M(105));
    });

    test('no cuenta dos veces un traspaso publicado desde los dos lados', () => {
        // Riesgo real: si el feed emite "A compró a B" y "B vendió a A" para el
        // mismo traspaso, aplicarlo dos veces duplicaría el movimiento.
        const l = buildBudgetLedger([
            compra('A', M(30), 'p1', 'B'),
            venta('B', M(30), 'p1', 'A'),
        ]);

        expect(getManagerBalance(l, 'A')).toBe(M(70));
        expect(getManagerBalance(l, 'B')).toBe(M(130));
        expect(l.duplicates).toBe(1);
    });

    test('dos traspasos distintos del mismo jugador sí cuentan por separado', () => {
        const l = buildBudgetLedger([
            compra('A', M(30), 'p1', 'B'),
            compra('C', M(45), 'p1', 'A'),
        ]);

        expect(getManagerBalance(l, 'A')).toBe(M(70) + M(45));
        expect(getManagerBalance(l, 'B')).toBe(M(130));
        expect(getManagerBalance(l, 'C')).toBe(M(55));
    });

    test('los tipos sin efecto en caja se ignoran sin marcarlos como desconocidos', () => {
        const l = buildBudgetLedger([
            { activityTypeId: 4, amount: M(5), user1Id: 'A' },  // blindó
            { activityTypeId: 7, user1Id: 'A' },                 // alineación incorrecta
            { activityTypeId: 9, user1Id: 'A' },                 // nuevo miembro
        ]);

        expect(getManagerBalance(l, 'A')).toBe(STARTING_BUDGET);
        expect(l.ignoredTypes.size).toBe(0);
    });

    test('un tipo nuevo se registra para poder avisar de que falta modelarlo', () => {
        const l = buildBudgetLedger([{ activityTypeId: 99, amount: M(5), user1Id: 'A' }]);

        expect(l.ignoredTypes.get(99)).toBe(1);
    });

    test('un manager sin movimientos conserva el presupuesto inicial', () => {
        const l = buildBudgetLedger([compra('A', M(20), 'p1')]);

        expect(getManagerBalance(l, 'B')).toBe(STARTING_BUDGET);
    });

    test('aguanta entradas corruptas y datos ausentes', () => {
        const l = buildBudgetLedger([null, {}, { activityTypeId: 1 }, { activityTypeId: 1, amount: 'x', user1Id: 'A' }]);

        expect(getManagerBalance(l, 'A')).toBe(STARTING_BUDGET);
        expect(l.applied).toBe(0);
        expect(getManagerBalance(null, 'A')).toBeUndefined();
    });

    test('el importe se toma en valor absoluto venga con el signo que venga', () => {
        const l = buildBudgetLedger([{ activityTypeId: 1, amount: -M(20), user1Id: 'A', playerMasterId: 'p1' }]);

        expect(getManagerBalance(l, 'A')).toBe(M(80));
    });
});

describe('buildBudgetLedger — managers sin id en el evento', () => {
    const nombres = new Map([['yaguettou', 'A'], ['juanitoooo21', 'B']]);

    test('resuelve por nombre cuando el evento no trae user1Id', () => {
        // La API mezcla formatos: algunos eventos solo traen el nombre. Si se
        // descartan, faltan movimientos reales y el saldo descuadra.
        const l = buildBudgetLedger(
            [{ activityTypeId: 6, amount: M(2.2), user1Name: 'Yaguettou' }],
            { managerIdByName: nombres },
        );

        expect(getManagerBalance(l, 'A')).toBe(M(102.2));
        expect(l.skipped.sinManager).toBe(0);
    });

    test('resuelve el nombre desde la frase de description', () => {
        const l = buildBudgetLedger(
            [{ activityTypeId: 6, amount: M(1), description: 'Juanitoooo21 ha ganado 1.000.000€ por jornada' }],
            { managerIdByName: nombres },
        );

        expect(getManagerBalance(l, 'B')).toBe(M(101));
    });

    test('resuelve también la contraparte por nombre', () => {
        const l = buildBudgetLedger(
            [{ activityTypeId: 1, amount: M(10), user1Name: 'Yaguettou', user2Name: 'Juanitoooo21', playerMasterId: 'p1' }],
            { managerIdByName: nombres },
        );

        expect(getManagerBalance(l, 'A')).toBe(M(90));
        expect(getManagerBalance(l, 'B')).toBe(M(110));
    });

    test('cuenta como descartado el evento cuyo manager no se puede resolver', () => {
        const l = buildBudgetLedger(
            [{ activityTypeId: 6, amount: M(5), user1Name: 'Desconocido' }],
            { managerIdByName: nombres },
        );

        expect(l.skipped.sinManager).toBe(1);
        expect(l.applied).toBe(0);
    });

    test('el id sigue teniendo prioridad sobre el nombre', () => {
        const l = buildBudgetLedger(
            [{ activityTypeId: 6, amount: M(3), user1Id: 'Z', user1Name: 'Yaguettou' }],
            { managerIdByName: nombres },
        );

        expect(getManagerBalance(l, 'Z')).toBe(M(103));
        expect(getManagerBalance(l, 'A')).toBe(STARTING_BUDGET);
    });
});

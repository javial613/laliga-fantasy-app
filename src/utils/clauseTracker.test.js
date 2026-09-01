import {
    detectarSubidasDeClausula,
    construirInstantanea,
    acumularCostes,
    intervaloAtribuible,
} from './clauseTracker';

const M = (n) => n * 1000000;
// Instantes en hora peninsular expresados en UTC (agosto: CEST = UTC+2).
const madrid = (iso) => new Date(iso).toISOString();
const MISMO_DIA_A = madrid('2026-08-26T08:36:00Z'); // 10:36 peninsular
const MISMO_DIA_B = madrid('2026-08-26T16:00:00Z'); // 18:00 peninsular
const DIA_ANTERIOR = madrid('2026-08-25T20:00:00Z'); // 22:00 del día antes

describe('intervaloAtribuible — ventana 00:14-00:30 peninsular', () => {
    // Agosto: Madrid va en CEST (UTC+2), así que 00:14 local = 22:14 UTC del día anterior.
    const VENTANA_INI_UTC = '2026-08-26T22:14:00Z'; // 00:14 del 27
    const VENTANA_FIN_UTC = '2026-08-26T22:30:00Z'; // 00:30 del 27

    test('un intervalo que no toca la ventana es atribuible', () => {
        expect(intervaloAtribuible('2026-08-26T08:00:00Z', '2026-08-26T16:00:00Z')).toBe(true);
    });

    test('justo después de la ventana y antes de la siguiente, atribuible', () => {
        // 00:31 -> 23:00 del mismo día: la revalorización ya pasó.
        expect(intervaloAtribuible('2026-08-26T22:31:00Z', '2026-08-27T21:00:00Z')).toBe(true);
    });

    test('un intervalo que contiene la ventana no es atribuible', () => {
        expect(intervaloAtribuible('2026-08-26T22:00:00Z', '2026-08-26T23:00:00Z')).toBe(false);
    });

    test('basta con solaparla parcialmente', () => {
        // Termina dentro de la ventana
        expect(intervaloAtribuible('2026-08-26T21:00:00Z', VENTANA_INI_UTC)).toBe(false);
        // Empieza dentro de la ventana
        expect(intervaloAtribuible(VENTANA_FIN_UTC, '2026-08-27T02:00:00Z')).toBe(false);
    });

    test('la franja entre medianoche y las 00:14 sigue siendo atribuible', () => {
        // 00:00 -> 00:13: la revalorización aún no se ha aplicado.
        expect(intervaloAtribuible('2026-08-26T22:00:00Z', '2026-08-26T22:13:00Z')).toBe(true);
    });

    test('un intervalo de varios días cruza alguna ventana', () => {
        expect(intervaloAtribuible('2026-08-20T10:00:00Z', '2026-08-26T10:00:00Z')).toBe(false);
    });

    test('funciona igual en horario de invierno', () => {
        // Enero: Madrid en CET (UTC+1), 00:14 local = 23:14 UTC del día anterior.
        expect(intervaloAtribuible('2027-01-14T23:00:00Z', '2027-01-14T23:45:00Z')).toBe(false);
        expect(intervaloAtribuible('2027-01-15T08:00:00Z', '2027-01-15T18:00:00Z')).toBe(true);
    });

    test('rechaza fechas inválidas o invertidas', () => {
        expect(intervaloAtribuible('no es fecha', '2026-08-26T10:00:00Z')).toBe(false);
        expect(intervaloAtribuible(null, null)).toBe(false);
        expect(intervaloAtribuible('2026-08-26T18:00:00Z', '2026-08-26T08:00:00Z')).toBe(false);
    });
});

describe('detectarSubidasDeClausula', () => {
    const intervaloBueno = { desde: MISMO_DIA_A, hasta: MISMO_DIA_B };

    test('detecta una subida manual y cobra la mitad', () => {
        const antes = { mbappe: { teamId: 'T1', clause: M(140), name: 'Mbappé' } };
        const ahora = { mbappe: { teamId: 'T1', clause: M(150), name: 'Mbappé' } };

        const { subidas } = detectarSubidasDeClausula(antes, ahora, intervaloBueno);

        expect(subidas).toHaveLength(1);
        expect(subidas[0].coste).toBe(M(5));
        expect(subidas[0].playerName).toBe('Mbappé');
    });

    test('no cobra nada si el intervalo cruza la revalorización nocturna', () => {
        // Este es el falso positivo real: subidas de valor de madrugada, con
        // porcentajes dispares, que antes se cobraban como si fueran pagadas.
        const antes = {
            soria:      { teamId: 'T1', clause: 25040360 },
            terrats:    { teamId: 'T1', clause: 3739152 },
            mariano:    { teamId: 'T1', clause: 4048119 },
            aubameyang: { teamId: 'T1', clause: 46494855 },
        };
        const ahora = {
            soria:      { teamId: 'T1', clause: 25899108 },  // +3,4%
            terrats:    { teamId: 'T1', clause: 3941037 },   // +5,4%
            mariano:    { teamId: 'T1', clause: 4541919 },   // +12,2%
            aubameyang: { teamId: 'T1', clause: 48282390 },  // +3,8%
        };

        const r = detectarSubidasDeClausula(antes, ahora, { desde: DIA_ANTERIOR, hasta: MISMO_DIA_A });

        expect(r.atribuible).toBe(false);
        expect(r.subidas).toHaveLength(0);
    });

    test('ignora a los jugadores que han cambiado de equipo', () => {
        const antes = { x: { teamId: 'T1', clause: M(10) } };
        const ahora = { x: { teamId: 'T2', clause: M(40) } };

        expect(detectarSubidasDeClausula(antes, ahora, intervaloBueno).subidas).toHaveLength(0);
    });

    test('ignora fichajes nuevos y bajas', () => {
        const r = detectarSubidasDeClausula(
            { viejo: { teamId: 'T1', clause: M(10) } },
            { nuevo: { teamId: 'T1', clause: M(90) } },
            intervaloBueno,
        );
        expect(r.subidas).toHaveLength(0);
        expect(r.comparados).toBe(0);
    });

    test('ignora diferencias de redondeo', () => {
        const r = detectarSubidasDeClausula(
            { x: { teamId: 'T1', clause: M(10) } },
            { x: { teamId: 'T1', clause: M(10) + 500 } },
            intervaloBueno,
        );
        expect(r.subidas).toHaveLength(0);
    });

    test('no revienta sin datos', () => {
        expect(detectarSubidasDeClausula(null, null, intervaloBueno).subidas).toEqual([]);
        expect(detectarSubidasDeClausula({}, {}, {}).atribuible).toBe(false);
    });
});

describe('construirInstantanea', () => {
    test('indexa por jugador con equipo, cláusula y nombre', () => {
        const snap = construirInstantanea(new Map([
            ['T1', [{ playerMaster: { id: 7, marketValue: M(5), nickname: 'Siete' },
                     buyoutClause: M(10), buyoutClauseLockedEndTime: '2026-09-02T10:00:00Z' }]],
            ['T2', [{ playerMaster: { id: 8, marketValue: M(3) }, buyoutClause: 0 }]],
            ['T3', [{ buyoutClause: M(9) }]],
        ]));

        expect(snap['7']).toEqual({
            teamId: 'T1', clause: M(10), marketValue: M(5), name: 'Siete',
            lockedUntil: '2026-09-02T10:00:00Z',
        });
        // El jugador sin cláusula también entra: hace falta para el valor del
        // equipo, y la detección ya lo ignora por tener cláusula 0.
        expect(snap['8'].clause).toBe(0);
        // Sin fecha de bloqueo: la cláusula está abierta.
        expect(snap['8'].lockedUntil).toBeNull();
        expect(Object.keys(snap)).toHaveLength(2);
    });
});

describe('acumularCostes', () => {
    test('suma sobre lo ya registrado y agrupa por equipo', () => {
        expect(acumularCostes({ T1: M(2) }, [
            { teamId: 'T1', coste: M(5) },
            { teamId: 'T2', coste: M(1) },
        ])).toEqual({ T1: M(7), T2: M(1) });
    });
});

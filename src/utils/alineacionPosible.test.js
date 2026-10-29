import {
    puedeAlinear, contarPorPosicion, esClausulable, analizarPlantilla, FORMACIONES,
} from './alineacionPosible';

const jugador = (id, positionId, clausula, lockedUntil = null) =>
    ({ playerId: id, nombre: `J${id}`, positionId, clausula, lockedUntil });

// Plantilla cómoda: 2 porteros, 5 defensas, 5 medios, 3 delanteros.
const plantillaHolgada = () => [
    jugador('p1', 1, 1_000_000), jugador('p2', 1, 1_000_000),
    ...[1, 2, 3, 4, 5].map((n) => jugador(`d${n}`, 2, n * 1_000_000)),
    ...[1, 2, 3, 4, 5].map((n) => jugador(`m${n}`, 3, n * 1_000_000)),
    ...[1, 2, 3].map((n) => jugador(`f${n}`, 4, n * 1_000_000)),
];

describe('formaciones disponibles', () => {
    test('no incluye ninguna de pago', () => {
        const prohibidas = [[5, 4, 1], [5, 2, 3], [4, 6, 0], [4, 2, 4], [3, 3, 4]];
        for (const p of prohibidas) {
            expect(FORMACIONES.some((f) => f.join('-') === p.join('-'))).toBe(false);
        }
    });

    test('todas suman diez jugadores de campo', () => {
        for (const f of FORMACIONES) expect(f.reduce((a, b) => a + b, 0)).toBe(10);
    });
});

describe('puedeAlinear', () => {
    test('con plantilla holgada, sí', () => {
        expect(puedeAlinear({ porteros: 1, defensas: 5, medios: 5, delanteros: 3 })).toBe(true);
    });

    test('sin portero no hay alineación por muchos de campo que haya', () => {
        expect(puedeAlinear({ porteros: 0, defensas: 8, medios: 8, delanteros: 8 })).toBe(false);
    });

    test('3 defensas y 3 medios NO vale: esa formación es premium', () => {
        // 3·3·4 existe en el juego, pero es de pago y aquí no cuenta.
        expect(puedeAlinear({ porteros: 1, defensas: 3, medios: 3, delanteros: 9 })).toBe(false);
    });

    test('con 3 defensas hacen falta 4 medios como mínimo', () => {
        expect(puedeAlinear({ porteros: 1, defensas: 3, medios: 4, delanteros: 3 })).toBe(true);
        expect(puedeAlinear({ porteros: 1, defensas: 3, medios: 5, delanteros: 2 })).toBe(true);
    });

    test('menos de 3 defensas no encaja en ninguna', () => {
        expect(puedeAlinear({ porteros: 1, defensas: 2, medios: 9, delanteros: 9 })).toBe(false);
    });

    test('hace falta al menos un delantero', () => {
        // 4·6·0 es premium, así que quedarse sin delanteros deja fuera.
        expect(puedeAlinear({ porteros: 1, defensas: 4, medios: 6, delanteros: 0 })).toBe(false);
    });

    test('menos de 3 medios tampoco encaja', () => {
        expect(puedeAlinear({ porteros: 1, defensas: 5, medios: 2, delanteros: 9 })).toBe(false);
    });
});

describe('contarPorPosicion', () => {
    test('reparte bien y no se inventa nada', () => {
        expect(contarPorPosicion(plantillaHolgada()))
            .toEqual({ porteros: 2, defensas: 5, medios: 5, delanteros: 3, otros: 0 });
        expect(contarPorPosicion([])).toEqual({ porteros: 0, defensas: 0, medios: 0, delanteros: 0, otros: 0 });
        expect(contarPorPosicion(null).porteros).toBe(0);
    });

    test('una posición desconocida no se cuela en ninguna línea', () => {
        expect(contarPorPosicion([jugador('x', 9, 1)]).otros).toBe(1);
    });
});

describe('esClausulable', () => {
    const ahora = Date.parse('2026-10-29T12:00:00Z');

    test('sin protección, sí', () => {
        expect(esClausulable(jugador('a', 2, 1_000_000, null), ahora)).toBe(true);
    });

    test('con protección vencida, sí', () => {
        expect(esClausulable(jugador('a', 2, 1_000_000, '2026-10-29T11:00:00Z'), ahora)).toBe(true);
    });

    test('protegido todavía, no', () => {
        expect(esClausulable(jugador('a', 2, 1_000_000, '2026-10-29T13:00:00Z'), ahora)).toBe(false);
    });

    test('sin cláusula no se puede pagar nada', () => {
        expect(esClausulable(jugador('a', 2, 0, null), ahora)).toBe(false);
        expect(esClausulable(null, ahora)).toBe(false);
    });

    test('una fecha ilegible se trata como desprotegido, no como error', () => {
        expect(esClausulable(jugador('a', 2, 1_000_000, 'vete a saber'), ahora)).toBe(true);
    });
});

describe('analizarPlantilla', () => {
    test('una plantilla holgada con todo protegido no es vulnerable', () => {
        const protegidos = plantillaHolgada().map((j) => ({ ...j, lockedUntil: '2099-01-01T00:00:00Z' }));
        const r = analizarPlantilla(protegidos);
        expect(r.total).toBe(15);
        expect(r.puedeAlinear).toBe(true);
        expect(r.clausulables).toBe(0);
        expect(r.vulnerable).toBe(false);
    });

    test('detecta el caso de la posición escasa', () => {
        // 17 jugadores pero solo 3 medios, y uno clausulable: al quitarlo
        // quedan 2 medios y no hay formación posible.
        const plantilla = [
            jugador('p1', 1, 1_000_000, '2099-01-01T00:00:00Z'),
            ...Array.from({ length: 8 }, (_, n) => jugador(`d${n}`, 2, 1_000_000, '2099-01-01T00:00:00Z')),
            jugador('m1', 3, 5_000_000, '2099-01-01T00:00:00Z'),
            jugador('m2', 3, 6_000_000, '2099-01-01T00:00:00Z'),
            jugador('m3', 3, 4_000_000), // el único sin proteger
            ...Array.from({ length: 5 }, (_, n) => jugador(`f${n}`, 4, 1_000_000, '2099-01-01T00:00:00Z')),
        ];
        const r = analizarPlantilla(plantilla);
        expect(r.total).toBe(17);
        expect(r.vulnerable).toBe(true);
        expect(r.jugada.jugadores.map((j) => j.playerId)).toEqual(['m3']);
        expect(r.jugada.coste).toBe(4_000_000);
    });

    test('cuando hacen falta dos, elige los dos más baratos de esa posición', () => {
        const plantilla = [
            jugador('p1', 1, 1_000_000, '2099-01-01T00:00:00Z'),
            ...Array.from({ length: 6 }, (_, n) => jugador(`d${n}`, 2, 1_000_000, '2099-01-01T00:00:00Z')),
            jugador('m1', 3, 9_000_000), jugador('m2', 3, 2_000_000),
            jugador('m3', 3, 3_000_000), jugador('m4', 3, 8_000_000),
            ...Array.from({ length: 4 }, (_, n) => jugador(`f${n}`, 4, 1_000_000, '2099-01-01T00:00:00Z')),
        ];
        const r = analizarPlantilla(plantilla);
        // De 4 medios hay que bajar a 2: dos bajas, las más baratas.
        expect(r.vulnerable).toBe(true);
        expect(r.jugada.jugadores.map((j) => j.playerId).sort()).toEqual(['m2', 'm3']);
        expect(r.jugada.coste).toBe(5_000_000);
    });

    test('el portero único desprotegido también deja sin alineación', () => {
        const plantilla = [
            jugador('p1', 1, 3_000_000),
            ...Array.from({ length: 5 }, (_, n) => jugador(`d${n}`, 2, 1_000_000, '2099-01-01T00:00:00Z')),
            ...Array.from({ length: 5 }, (_, n) => jugador(`m${n}`, 3, 1_000_000, '2099-01-01T00:00:00Z')),
            ...Array.from({ length: 3 }, (_, n) => jugador(`f${n}`, 4, 1_000_000, '2099-01-01T00:00:00Z')),
        ];
        const r = analizarPlantilla(plantilla);
        expect(r.vulnerable).toBe(true);
        expect(r.jugada.jugadores.map((j) => j.playerId)).toEqual(['p1']);
    });

    test('respeta un tope de gasto', () => {
        const plantilla = [
            jugador('p1', 1, 1_000_000, '2099-01-01T00:00:00Z'),
            ...Array.from({ length: 8 }, (_, n) => jugador(`d${n}`, 2, 1_000_000, '2099-01-01T00:00:00Z')),
            jugador('m1', 3, 1_000_000, '2099-01-01T00:00:00Z'),
            jugador('m2', 3, 1_000_000, '2099-01-01T00:00:00Z'),
            jugador('m3', 3, 50_000_000),
            ...Array.from({ length: 5 }, (_, n) => jugador(`f${n}`, 4, 1_000_000, '2099-01-01T00:00:00Z')),
        ];
        expect(analizarPlantilla(plantilla).vulnerable).toBe(true);
        expect(analizarPlantilla(plantilla, { topeGasto: 10_000_000 }).vulnerable).toBe(false);
    });

    test('si ya no puede alinear, no hay jugada que provocar', () => {
        const r = analizarPlantilla([jugador('p1', 1, 1_000_000)]);
        expect(r.puedeAlinear).toBe(false);
        expect(r.vulnerable).toBe(false);
    });

    test('plantilla vacía o nula no revienta', () => {
        expect(analizarPlantilla([]).total).toBe(0);
        expect(analizarPlantilla(null).vulnerable).toBe(false);
    });
});

describe('el cierre de cláusulas manda', () => {
    const ahora = Date.parse('2026-10-29T10:00:00+01:00');
    const limite = Date.parse('2026-10-29T21:00:00+01:00');

    // Plantilla justa de medios: si se le quita uno, no hay formación.
    const plantilla = (lockDelMedio) => [
        jugador('p1', 1, 1_000_000, '2099-01-01T00:00:00Z'),
        ...Array.from({ length: 8 }, (_, n) => jugador(`d${n}`, 2, 1_000_000, '2099-01-01T00:00:00Z')),
        jugador('m1', 3, 1_000_000, '2099-01-01T00:00:00Z'),
        jugador('m2', 3, 1_000_000, '2099-01-01T00:00:00Z'),
        jugador('m3', 3, 4_000_000, lockDelMedio),
        ...Array.from({ length: 5 }, (_, n) => jugador(`f${n}`, 4, 1_000_000, '2099-01-01T00:00:00Z')),
    ];

    test('cuenta a quien se desbloquea antes del cierre, aunque ahora esté protegido', () => {
        const r = analizarPlantilla(plantilla('2026-10-29T18:00:00+01:00'), { ahora, limite });
        expect(r.vulnerable).toBe(true);
        expect(r.jugada.jugadores.map((j) => j.playerId)).toEqual(['m3']);
    });

    test('no cuenta a quien se desbloquea cuando ya no da tiempo', () => {
        // Se abre dos horas después del cierre: para esa jornada es intocable.
        const r = analizarPlantilla(plantilla('2026-10-29T23:00:00+01:00'), { ahora, limite });
        expect(r.vulnerable).toBe(false);
        expect(r.clausulables).toBe(0);
    });

    test('sin cierre conocido se mira solo lo que ya está abierto', () => {
        const r = analizarPlantilla(plantilla('2026-10-29T18:00:00+01:00'), { ahora });
        expect(r.vulnerable).toBe(false);
    });
});

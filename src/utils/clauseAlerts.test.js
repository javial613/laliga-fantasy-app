import { seleccionarAvisos, limpiarAvisados, claveAviso } from './clauseAlerts';

const AHORA = Date.parse('2026-09-01T10:00:00Z');
const enHoras = (h) => new Date(AHORA + h * 3600 * 1000).toISOString();

const jugador = (extra = {}) => ({
    teamId: 'T2', clause: 50000000, marketValue: 48000000, name: 'Vinícius',
    lockedUntil: enHoras(5), ...extra,
});

describe('seleccionarAvisos', () => {
    test('anuncia los que se abren dentro de la ventana', () => {
        const avisos = seleccionarAvisos({ p1: jugador() }, { ahora: AHORA });

        expect(avisos).toHaveLength(1);
        expect(avisos[0].nombre).toBe('Vinícius');
        expect(avisos[0].apertura).toBe(Date.parse(enHoras(5)));
    });

    test('no anuncia los que aún quedan lejos', () => {
        const avisos = seleccionarAvisos({ p1: jugador({ lockedUntil: enHoras(50) }) }, { ahora: AHORA });
        expect(avisos).toHaveLength(0);
    });

    test('no anuncia los que ya están abiertos', () => {
        // Ya pasada la fecha, o sin fecha: no hay nada que anticipar.
        const avisos = seleccionarAvisos({
            p1: jugador({ lockedUntil: enHoras(-2) }),
            p2: jugador({ lockedUntil: null }),
        }, { ahora: AHORA });
        expect(avisos).toHaveLength(0);
    });

    test('no repite un aviso ya enviado', () => {
        const j = { p1: jugador() };
        const primera = seleccionarAvisos(j, { ahora: AHORA });
        const yaAvisados = { [primera[0].clave]: primera[0].apertura };

        expect(seleccionarAvisos(j, { ahora: AHORA, yaAvisados })).toHaveLength(0);
    });

    test('vuelve a avisar si lo blindan y cambia la fecha de apertura', () => {
        // Blindar empuja la apertura 24h: es un evento nuevo, no un duplicado.
        const antes = seleccionarAvisos({ p1: jugador() }, { ahora: AHORA });
        const yaAvisados = { [antes[0].clave]: antes[0].apertura };
        const despues = seleccionarAvisos(
            { p1: jugador({ lockedUntil: enHoras(20) }) },
            { ahora: AHORA, yaAvisados },
        );

        expect(despues).toHaveLength(1);
        expect(despues[0].clave).not.toBe(antes[0].clave);
    });

    test('marca cuáles son propios y resuelve el nombre del manager', () => {
        const avisos = seleccionarAvisos({
            mio: jugador({ teamId: 'T1' }),
            rival: jugador({ teamId: 'T2', lockedUntil: enHoras(6) }),
        }, {
            ahora: AHORA, miEquipo: 'T1',
            nombrePorEquipo: new Map([['T1', 'Yaguettou'], ['T2', 'Juanitoooo21']]),
        });

        expect(avisos.find((a) => a.teamId === 'T1').esMio).toBe(true);
        expect(avisos.find((a) => a.teamId === 'T2').esMio).toBe(false);
        expect(avisos.find((a) => a.teamId === 'T2').manager).toBe('Juanitoooo21');
    });

    test('calcula cuánto es ganga: valor por encima de la cláusula', () => {
        const [a] = seleccionarAvisos(
            { p1: jugador({ clause: 40000000, marketValue: 55000000 }) },
            { ahora: AHORA },
        );
        expect(a.gangaPor).toBe(15000000);
    });

    test('ordena por hora de apertura, lo más inminente primero', () => {
        const avisos = seleccionarAvisos({
            tarde: jugador({ lockedUntil: enHoras(9) }),
            pronto: jugador({ lockedUntil: enHoras(1) }),
        }, { ahora: AHORA });

        expect(avisos.map((a) => a.playerId)).toEqual(['pronto', 'tarde']);
    });

    test('aguanta datos ausentes o corruptos', () => {
        expect(seleccionarAvisos(null, { ahora: AHORA })).toEqual([]);
        expect(seleccionarAvisos({ p1: { lockedUntil: 'no es fecha' } }, { ahora: AHORA })).toEqual([]);
    });
});

describe('limpiarAvisados', () => {
    test('conserva los futuros y descarta los pasados', () => {
        const limpio = limpiarAvisados({
            [claveAviso('p1', enHoras(5))]: AHORA + 5 * 3600 * 1000,
            [claveAviso('p2', enHoras(-5))]: AHORA - 5 * 3600 * 1000,
        }, AHORA);

        expect(Object.keys(limpio)).toHaveLength(1);
    });

    test('no revienta sin datos', () => {
        expect(limpiarAvisados(null, AHORA)).toEqual({});
    });
});

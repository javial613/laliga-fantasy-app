import { claveDeteccion } from './useDismissedClauseDetections';

describe('claveDeteccion', () => {
    const base = { playerId: '7', clauseAnterior: 140000000, clauseActual: 150000000 };

    test('la misma detección da siempre la misma clave', () => {
        // La fecha no entra a propósito: es cuándo se detectó, no qué pasó, y
        // cambiaría si el histórico se regenerase, resucitando lo descartado.
        expect(claveDeteccion({ ...base, fecha: '2026-09-01T10:00:00Z' }))
            .toBe(claveDeteccion({ ...base, fecha: '2026-09-02T18:30:00Z' }));
    });

    test('distingue subidas distintas del mismo jugador', () => {
        expect(claveDeteccion(base)).not.toBe(claveDeteccion({ ...base, clauseActual: 160000000 }));
        expect(claveDeteccion(base)).not.toBe(claveDeteccion({ ...base, clauseAnterior: 130000000 }));
    });

    test('distingue jugadores', () => {
        expect(claveDeteccion(base)).not.toBe(claveDeteccion({ ...base, playerId: '8' }));
    });

    test('no revienta con datos incompletos', () => {
        expect(typeof claveDeteccion({})).toBe('string');
        expect(typeof claveDeteccion(null)).toBe('string');
    });
});

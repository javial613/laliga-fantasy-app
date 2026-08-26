import { construirIndiceTitularidad, slugsParaEquipos, slugPorTeamId } from './starterProbabilities';

const alineacion = (source, starting = [], bench = []) => ({ source, players: { starting, bench } });

describe('slugsParaEquipos', () => {
    test('traduce ids de equipo a slugs sin repetir', () => {
        expect(slugsParaEquipos(['15', 15, '3'])).toEqual(['real-madrid', 'barcelona']);
    });

    test('ignora ids desconocidos', () => {
        expect(slugsParaEquipos(['99999', null, undefined])).toEqual([]);
    });

    test('el mapa cubre los 20 equipos', () => {
        expect(slugPorTeamId.size).toBe(20);
    });
});

describe('construirIndiceTitularidad', () => {
    test('indexa titulares y suplentes del scraping', () => {
        const idx = construirIndiceTitularidad([
            alineacion('scraping_based',
                [{ id: 1, isStarter: true, probability: 92, source: 'scraping' }],
                [{ id: 2, isStarter: false, probability: 30, source: 'scraping' }]),
        ]);

        expect(idx.get('1')).toEqual({ probability: 92, isStarter: true });
        expect(idx.get('2')).toEqual({ probability: 30, isStarter: false });
    });

    test('descarta las alineaciones que no vienen de scraping', () => {
        // Es el caso peligroso: el servicio inventa 75/25 cuando falla el
        // scraping, y eso no puede llegar a la tarjeta como si fuera real.
        const idx = construirIndiceTitularidad([
            alineacion('laliga-api-only',
                [{ id: 1, isStarter: true, probability: 75, source: 'laliga-api' }],
                [{ id: 2, isStarter: false, probability: 25, source: 'laliga-api' }]),
            alineacion('fallback', [{ id: 3, isStarter: true, probability: 75 }]),
        ]);

        expect(idx.size).toBe(0);
    });

    test('descarta jugadores de relleno dentro de una alineación buena', () => {
        const idx = construirIndiceTitularidad([
            alineacion('scraping_supplemented',
                [{ id: 1, isStarter: true, probability: 88, source: 'scraping' },
                 { id: 2, isStarter: true, probability: 75, source: 'laliga-api-supplement' }]),
        ]);

        expect(idx.get('1')).toBeTruthy();
        expect(idx.has('2')).toBe(false);
    });

    test('una probabilidad de 0 se guarda como desconocida, no como 0%', () => {
        const idx = construirIndiceTitularidad([
            alineacion('scraping_based', [{ id: 1, isStarter: true, probability: 0, source: 'scraping' }]),
        ]);

        expect(idx.get('1')).toEqual({ probability: null, isStarter: true });
    });

    test('aguanta datos ausentes o corruptos', () => {
        expect(construirIndiceTitularidad(null).size).toBe(0);
        expect(construirIndiceTitularidad([null, {}, { source: 'scraping_based' }]).size).toBe(0);
        expect(construirIndiceTitularidad([
            alineacion('scraping_based', [{ id: 5, probability: 50 }]),  // sin isStarter
        ]).size).toBe(0);
    });
});

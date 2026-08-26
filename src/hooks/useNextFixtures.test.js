import {
    extractMatches,
    buildFixtureMap,
    hasMatchStarted,
    hasRoundStarted,
} from './useNextFixtures';

const team = (id, name) => ({ id, name, shortName: name.slice(0, 3).toUpperCase(), badgeColor: `https://cdn/${id}.png` });

const RMA = team(15, 'Real Madrid');
const GET = team(8, 'Getafe');
const ATH = team(1, 'Athletic');
const SEV = team(17, 'Sevilla');

const EN_UNA_HORA = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const HACE_UNA_HORA = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('extractMatches', () => {
    test('acepta las formas de respuesta del calendario', () => {
        const partidos = [{ id: 1 }];

        expect(extractMatches(partidos)).toBe(partidos);
        expect(extractMatches({ data: partidos })).toBe(partidos);
        expect(extractMatches({ elements: partidos })).toBe(partidos);
        expect(extractMatches({ data: { elements: partidos } })).toBe(partidos);
    });

    test('devuelve lista vacía ante formas desconocidas', () => {
        expect(extractMatches(null)).toEqual([]);
        expect(extractMatches({ algo: 1 })).toEqual([]);
    });
});

describe('hasMatchStarted', () => {
    test('los estados en juego y finalizado cuentan como empezado', () => {
        expect(hasMatchStarted({ matchState: 2 })).toBe(true);  // 1ª parte
        expect(hasMatchStarted({ matchState: 4 })).toBe(true);  // 2ª parte
        expect(hasMatchStarted({ matchState: 7 })).toBe(true);  // finalizado
    });

    test('sin empezar mientras el estado sea previo y la hora no haya llegado', () => {
        expect(hasMatchStarted({ matchState: 0, matchDate: EN_UNA_HORA() })).toBe(false);
        expect(hasMatchStarted({ matchState: 1, matchDate: EN_UNA_HORA() })).toBe(false);
        expect(hasMatchStarted(null)).toBe(false);
    });

    test('respaldo por fecha cuando la API aún no informa el estado', () => {
        expect(hasMatchStarted({ matchDate: HACE_UNA_HORA() })).toBe(true);
        expect(hasMatchStarted({ matchDate: EN_UNA_HORA() })).toBe(false);
        expect(hasMatchStarted({ matchDate: 'fecha inválida' })).toBe(false);
        expect(hasMatchStarted({})).toBe(false);
    });
});

describe('hasRoundStarted', () => {
    test('basta UN partido empezado para dar la jornada por arrancada', () => {
        // Es la regla pedida: en cuanto arranca el primer partido, el mercado
        // mira a la jornada siguiente para todos los jugadores, porque un
        // fichaje ya no entra en la alineación de la jornada en curso.
        const jornada = [
            { matchState: 7, local: RMA, visitor: GET },                          // viernes, jugado
            { matchState: 0, local: ATH, visitor: SEV, matchDate: EN_UNA_HORA() }, // domingo
        ];

        expect(hasRoundStarted(jornada)).toBe(true);
    });

    test('no ha arrancado si ningún partido ha empezado', () => {
        const jornada = [
            { matchState: 0, local: RMA, visitor: GET, matchDate: EN_UNA_HORA() },
            { matchState: 0, local: ATH, visitor: SEV, matchDate: EN_UNA_HORA() },
        ];

        expect(hasRoundStarted(jornada)).toBe(false);
    });

    test('una jornada entera jugada también cuenta como arrancada', () => {
        expect(hasRoundStarted([{ matchState: 7 }, { matchState: 7 }])).toBe(true);
    });

    test('una jornada sin partidos no arrastra a la siguiente', () => {
        // Si el calendario viene vacío no hay que asumir que ya se jugó: eso
        // saltaría a la jornada +1 sin motivo.
        expect(hasRoundStarted([])).toBe(false);
    });
});

describe('buildFixtureMap', () => {
    test('indexa ambos equipos de cada partido con su condición de local', () => {
        const map = buildFixtureMap([
            { local: RMA, visitor: GET, matchDate: '2026-08-20T20:00:00Z' },
            { local: ATH, visitor: SEV, matchDate: '2026-08-21T18:00:00Z' },
        ]);

        expect(map.get('15')).toMatchObject({ opponent: GET, isHome: true });
        expect(map.get('8')).toMatchObject({ opponent: RMA, isHome: false });
        expect(map.get('1')).toMatchObject({ opponent: SEV, isHome: true });
        expect(map.get('17')).toMatchObject({ opponent: ATH, isHome: false });
        expect(map.get('15').matchDate).toBe('2026-08-20T20:00:00Z');
    });

    test('las claves son cadenas, venga el id como número o como texto', () => {
        const map = buildFixtureMap([{ local: { ...RMA, id: '15' }, visitor: GET }]);

        expect(map.get('15')).toBeDefined();
        expect(map.get(String(8))).toBeDefined();
    });

    test('ignora partidos incompletos sin romper el resto', () => {
        const map = buildFixtureMap([
            null,
            { local: RMA },     // sin visitante
            { visitor: SEV },   // sin local
            { local: ATH, visitor: GET },
        ]);

        expect(map.get('15')).toBeUndefined();
        expect(map.get('1')).toMatchObject({ opponent: GET, isHome: true });
        expect(map.size).toBe(2);
    });
});

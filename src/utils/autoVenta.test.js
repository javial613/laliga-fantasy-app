import { detectarFichajes, idsDePlantilla, aPonerEnVenta, MAX_POR_TANDA } from './autoVenta';

const j = (id, extra = {}) => ({ playerMasterId: id, nombre: `J${id}`, valor: 1_000_000, enVenta: false, ...extra });

describe('detección de fichajes', () => {
    test('un jugador que antes no estaba es un fichaje', () => {
        const r = detectarFichajes(['1', '2'], [j('1'), j('2'), j('3')]);
        expect(r.nuevos.map((x) => x.playerMasterId)).toEqual(['3']);
        expect(r.esPrimeraVez).toBe(false);
    });

    test('la primera comprobación no vende nada', () => {
        // Sin foto previa, toda la plantilla parecería recién fichada.
        const r = detectarFichajes(null, [j('1'), j('2'), j('3')]);
        expect(r.nuevos).toEqual([]);
        expect(r.esPrimeraVez).toBe(true);
    });

    test('sin cambios no hay fichajes', () => {
        expect(detectarFichajes(['1', '2'], [j('1'), j('2')]).nuevos).toEqual([]);
    });

    test('las bajas no cuentan como fichajes', () => {
        expect(detectarFichajes(['1', '2', '3'], [j('1')]).nuevos).toEqual([]);
    });

    test('compara como texto: 7 y "7" son el mismo jugador', () => {
        expect(detectarFichajes([7], [j('7')]).nuevos).toEqual([]);
    });

    test('demasiados de golpe se marca como sospechoso', () => {
        const muchos = ['a', 'b', 'c', 'd'].map((x) => j(x));
        const r = detectarFichajes([], muchos);
        expect(r.nuevos).toHaveLength(4);
        expect(r.demasiados).toBe(true);
        expect(MAX_POR_TANDA).toBe(3);
    });

    test('justo en el tope no es sospechoso', () => {
        expect(detectarFichajes([], ['a', 'b', 'c'].map((x) => j(x))).demasiados).toBe(false);
    });

    test('entradas absurdas no revientan', () => {
        expect(detectarFichajes(['1'], null).nuevos).toEqual([]);
        expect(detectarFichajes(['1'], [null, undefined, {}]).nuevos).toEqual([]);
    });
});

describe('ids de plantilla', () => {
    test('saca los ids como texto y descarta los que faltan', () => {
        expect(idsDePlantilla([j('1'), { playerId: 2 }, {}, null])).toEqual(['1', '2']);
        expect(idsDePlantilla(null)).toEqual([]);
    });
});

describe('a quién anunciar', () => {
    test('deja fuera a quien ya está en venta', () => {
        const r = aPonerEnVenta([j('1'), j('2', { enVenta: true })]);
        expect(r.map((x) => x.playerMasterId)).toEqual(['1']);
    });

    test('deja fuera a quien no tiene valor de mercado', () => {
        // Sin valor no hay precio al que anunciarlo.
        expect(aPonerEnVenta([j('1', { valor: 0 }), j('2', { valor: null })])).toEqual([]);
    });

    test('lista vacía o nula no revienta', () => {
        expect(aPonerEnVenta(null)).toEqual([]);
    });
});

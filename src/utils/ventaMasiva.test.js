import {
    cruzarPlantillaConMercado, buscarAnuncio, precioDeVenta,
    repartirAcciones, ejecutarEnSerie, idDePlantilla,
} from './ventaMasiva';

const jugadorPlantilla = (playerTeamId, masterId, nombre, valor) => ({
    playerTeamId,
    playerMaster: { id: masterId, nickname: nombre, marketValue: valor, positionId: 3 },
});

describe('cruce de plantilla y mercado', () => {
    const plantilla = [
        jugadorPlantilla('pt1', 'm1', 'Aubameyang', 60_000_000),
        jugadorPlantilla('pt2', 'm2', 'Mariano', 7_500_000),
    ];
    const anuncios = [{ id: 'anuncio-9', playerMaster: { id: 'm2' }, salePrice: 8_000_000 }];

    test('marca quién está en venta y con qué anuncio', () => {
        const [auba, mariano] = cruzarPlantillaConMercado(plantilla, anuncios);
        expect(auba.enVenta).toBe(false);
        expect(auba.marketId).toBeNull();
        expect(mariano.enVenta).toBe(true);
        // El id del anuncio NO es el del jugador: es el que hace falta para retirar.
        expect(mariano.marketId).toBe('anuncio-9');
        expect(mariano.precioActual).toBe(8_000_000);
    });

    test('sin mercado cargado, nadie figura en venta', () => {
        expect(cruzarPlantillaConMercado(plantilla, null).every((j) => !j.enVenta)).toBe(true);
        expect(cruzarPlantillaConMercado(null, anuncios)).toEqual([]);
    });

    test('el anuncio se encuentra por cualquiera de las formas que usa la API', () => {
        expect(buscarAnuncio([{ id: 'a', playerTeam: { playerTeamId: 'm3' } }], 'm3').id).toBe('a');
        expect(buscarAnuncio([{ id: 'a', playerTeam: { id: 'm4' } }], 'm4').id).toBe('a');
        expect(buscarAnuncio([{ id: 'a', playerMaster: { id: 'm5' } }], 'otro')).toBeNull();
        expect(buscarAnuncio([], 'm1')).toBeNull();
    });

    test('para poner a la venta se usa el id de plantilla', () => {
        expect(idDePlantilla({ playerTeamId: 'pt1', id: 'otro' })).toBe('pt1');
        expect(idDePlantilla({ id: 'pt2' })).toBe('pt2');
        expect(idDePlantilla(null)).toBeNull();
    });
});

describe('precio de salida', () => {
    test('aplica el porcentaje y redondea al millar', () => {
        expect(precioDeVenta(10_000_000)).toBe(10_000_000);
        expect(precioDeVenta(10_000_000, 110)).toBe(11_000_000);
        expect(precioDeVenta(7_507_168, 100)).toBe(7_507_000);
        expect(precioDeVenta(1_234_567, 125)).toBe(1_543_000);
    });

    test('un valor inservible da 0 en vez de NaN', () => {
        expect(precioDeVenta(null)).toBe(0);
        expect(precioDeVenta(undefined, 150)).toBe(0);
        expect(precioDeVenta(-5)).toBe(0);
    });
});

describe('reparto de acciones', () => {
    const jugadores = [
        { playerMasterId: 'm1', enVenta: false, marketId: null },
        { playerMasterId: 'm2', enVenta: true, marketId: 'a2' },
        { playerMasterId: 'm3', enVenta: true, marketId: null },
        { playerMasterId: 'm4', enVenta: false, marketId: null },
    ];

    test('separa poner, quitar y los que no se pueden tocar', () => {
        const r = repartirAcciones(jugadores, new Set(['m1', 'm2', 'm3']));
        expect(r.aPoner.map((j) => j.playerMasterId)).toEqual(['m1']);
        expect(r.aQuitar.map((j) => j.playerMasterId)).toEqual(['m2']);
        // En venta pero sin anuncio localizable: ni se intenta.
        expect(r.sinAnuncio.map((j) => j.playerMasterId)).toEqual(['m3']);
    });

    test('ignora a los no seleccionados', () => {
        const r = repartirAcciones(jugadores, new Set());
        expect(r.aPoner).toEqual([]);
        expect(r.aQuitar).toEqual([]);
    });
});

describe('ejecución en serie', () => {
    test('va de uno en uno, no todos a la vez', async () => {
        let simultaneos = 0;
        let maximo = 0;
        await ejecutarEnSerie([1, 2, 3], async () => {
            simultaneos += 1;
            maximo = Math.max(maximo, simultaneos);
            await new Promise((r) => setTimeout(r, 1));
            simultaneos -= 1;
        });
        expect(maximo).toBe(1);
    });

    test('un fallo no corta la tanda y se informa al final', async () => {
        const vistos = [];
        const r = await ejecutarEnSerie(['a', 'b', 'c'], async (x) => {
            vistos.push(x);
            if (x === 'b') throw new Error('rechazado');
        });
        expect(vistos).toEqual(['a', 'b', 'c']);
        expect(r.exitos).toBe(2);
        expect(r.fallos).toHaveLength(1);
        expect(r.fallos[0].elemento).toBe('b');
    });

    test('informa del avance', async () => {
        const avances = [];
        await ejecutarEnSerie(['a', 'b'], async () => {}, (hechos, total) => avances.push(`${hechos}/${total}`));
        expect(avances).toEqual(['1/2', '2/2']);
    });
});

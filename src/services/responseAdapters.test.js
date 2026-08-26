import { getPlayerImageOverride } from '../utils/playerImageOverrides';
import {
    normalizePlayer,
    createAdaptMarketResponse,
    createAdaptTeamDataResponse,
    createAdaptLineupResponse,
} from './responseAdapters';

// La API v6 devuelve los jugadores con `teamId` pero sin objeto `team`; el
// mapa de teams-master es lo que aporta nombre y escudo.
const teamsMap = new Map([
    ['15', {
        id: 15,
        name: 'Real Madrid',
        shortName: 'RMA',
        slug: 'real-madrid',
        badgeColor: 'https://cdn/rma-color.png',
        badgeWhite: 'https://cdn/rma-white.png',
    }],
]);

const loadTeamsMaster = () => Promise.resolve(teamsMap);
const rawPlayer = (overrides = {}) => ({
    id: 101,
    nickname: 'Mbappé',
    positionId: 4,
    teamId: 15,
    ...overrides,
});

describe('createAdaptMarketResponse', () => {
    const adapt = createAdaptMarketResponse(loadTeamsMaster);

    test('rellena el equipo de cada anuncio del mercado', async () => {
        const response = { data: [{ id: 7, salePrice: 1000, playerMaster: rawPlayer() }] };

        const { data } = await adapt(response);
        const team = data[0].playerMaster.team;

        expect(team.name).toBe('Real Madrid');
        expect(team.badgeColor).toBe('https://cdn/rma-color.png');
        expect(data[0].salePrice).toBe(1000);
    });

    test('soporta la forma {elements:[...]}', async () => {
        const response = { data: { elements: [{ playerMaster: rawPlayer() }] } };

        const { data } = await adapt(response);

        expect(data.elements[0].playerMaster.team.name).toBe('Real Madrid');
    });

    test('respeta un objeto team ya presente y no rompe formas inesperadas', async () => {
        const conTeam = { data: [{ playerMaster: rawPlayer({ team: { id: 15, name: 'Ya venía' } }) }] };
        const { data } = await adapt(conTeam);
        expect(data[0].playerMaster.team.name).toBe('Ya venía');

        const raro = { data: { algo: 'otra cosa' } };
        expect(await adapt(raro)).toBe(raro);
    });
});

describe('createAdaptTeamDataResponse', () => {
    const adapt = createAdaptTeamDataResponse(loadTeamsMaster);

    test('rellena el equipo de cada jugador de la plantilla', async () => {
        const response = { data: { money: 500, players: [{ playerTeamId: 3, playerMaster: rawPlayer() }] } };

        const { data } = await adapt(response);

        expect(data.players[0].playerMaster.team.badgeColor).toBe('https://cdn/rma-color.png');
        expect(data.money).toBe(500);
    });

    test('soporta la envoltura {data:{data:{...}}}', async () => {
        const response = { data: { data: { players: [{ playerMaster: rawPlayer() }] } } };

        const { data } = await adapt(response);

        expect(data.data.players[0].playerMaster.team.name).toBe('Real Madrid');
    });
});

describe('createAdaptLineupResponse', () => {
    const adapt = createAdaptLineupResponse(loadTeamsMaster);

    test('rellena el equipo en las cuatro líneas de la alineación', async () => {
        const response = {
            data: {
                formation: {
                    goalkeeper: [{ playerMaster: rawPlayer({ id: 1, positionId: 1 }) }],
                    defender: [{ playerMaster: rawPlayer({ id: 2, positionId: 2 }) }],
                    midfield: [{ playerMaster: rawPlayer({ id: 3, positionId: 3 }) }],
                    striker: [{ playerMaster: rawPlayer({ id: 4 }) }],
                    tacticalFormation: [4, 3, 3],
                },
            },
        };

        const { data } = await adapt(response);

        for (const line of ['goalkeeper', 'defender', 'midfield', 'striker']) {
            expect(data.formation[line][0].playerMaster.team.badgeColor)
                .toBe('https://cdn/rma-color.png');
        }
        // La formación táctica no es una línea de jugadores: debe sobrevivir intacta.
        expect(data.formation.tacticalFormation).toEqual([4, 3, 3]);
    });

    test('devuelve la respuesta tal cual si no hay formación', async () => {
        const response = { data: { algo: 1 } };
        expect(await adapt(response)).toBe(response);
    });
});

describe('normalizePlayer — foto local de respaldo', () => {
    const AUBAMEYANG = 188567;

    test('pone la foto local a un jugador que la API sirve sin imagen', () => {
        const p = normalizePlayer({ id: AUBAMEYANG, nickname: 'Aubameyang', teamId: 15 }, teamsMap);

        expect(p.images.transparent['256x256']).toBeTruthy();
        expect(p.images.player).toBe(p.images.transparent['256x256']);
    });

    test('la foto local manda sobre la de la API para ese jugador', () => {
        // El override existe justo porque allí no hay foto utilizable: si la
        // API devolviera una URL rota, seguiríamos viendo un hueco.
        const p = normalizePlayer({
            id: AUBAMEYANG,
            nickname: 'Aubameyang',
            images: { transparent: { '256x256': 'https://api/rota.png' } },
        }, teamsMap);

        expect(p.images.transparent['256x256']).not.toBe('https://api/rota.png');
    });

    test('no toca a los jugadores sin override', () => {
        const p = normalizePlayer({
            id: 999,
            nickname: 'Otro',
            images: { transparent: { '256x256': 'https://api/foto.png' }, big: 'https://api/big.png' },
        }, teamsMap);

        expect(p.images.transparent['256x256']).toBe('https://api/foto.png');
        // Los demás tamaños que venían de la API deben sobrevivir.
        expect(p.images.big).toBe('https://api/big.png');
    });

    test('sin imagen ni override, images queda como estaba', () => {
        expect(normalizePlayer({ id: 999, nickname: 'Otro' }, teamsMap).images).toBeUndefined();
    });
});

describe('getPlayerImageOverride — localización por id o por nombre', () => {
    test('encuentra por id', () => {
        expect(getPlayerImageOverride({ id: 188567 })).toBeTruthy();
        expect(getPlayerImageOverride({ id: '188567' })).toBeTruthy();
        expect(getPlayerImageOverride(188567)).toBeTruthy();
    });

    test('encuentra por nombre aunque el id no sea el esperado', () => {
        // Es el caso que importa: el id se dedujo del nombre de un fichero y
        // puede no ser el real. El nombre evita que la foto falle en silencio.
        expect(getPlayerImageOverride({ id: 999999, nickname: 'Aubameyang' })).toBeTruthy();
        expect(getPlayerImageOverride({ id: 999999, name: 'Pierre-Emerick Aubameyang' })).toBeTruthy();
        expect(getPlayerImageOverride({ nickname: 'P. Aubameyang' })).toBeTruthy();
        expect(getPlayerImageOverride({ nickname: 'AUBAMEYANG' })).toBeTruthy();
    });

    test('encuentra a Bright Ede por id y por nombre', () => {
        expect(getPlayerImageOverride({ id: 18030 })).toBeTruthy();
        expect(getPlayerImageOverride({ nickname: 'Bright Ede' })).toBeTruthy();
        expect(getPlayerImageOverride({ nickname: 'B. Ede' })).toBeTruthy();
        expect(getPlayerImageOverride({ id: 1, name: 'Bright Ede' })).toBeTruthy();
    });

    test('cada jugador recibe su propia foto, no la del otro', () => {
        const aub = getPlayerImageOverride({ nickname: 'Aubameyang' });
        const ede = getPlayerImageOverride({ nickname: 'Bright Ede' });
        expect(aub).toBeTruthy();
        expect(ede).toBeTruthy();
        expect(aub).not.toBe(ede);
    });

    test('no confunde a otros jugadores', () => {
        expect(getPlayerImageOverride({ id: 1, nickname: 'Mbappé' })).toBeNull();
        expect(getPlayerImageOverride({ nickname: '' })).toBeNull();
        expect(getPlayerImageOverride(null)).toBeNull();
    });
});

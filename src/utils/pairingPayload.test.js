import {
    codificarEmparejamiento,
    descodificarEmparejamiento,
    leerEmparejamientoDeHash,
    construirEnlaceEmparejamiento,
} from './pairingPayload';

describe('emparejamiento móvil', () => {
    const datos = { refreshToken: 'abc.DEF-123_xyz', clientId: 'cid-1', leagueId: '018592924', leagueName: 'liga Xixarito' };

    test('lo codificado se vuelve a leer igual', () => {
        expect(descodificarEmparejamiento(codificarEmparejamiento(datos))).toEqual({
            refreshToken: 'abc.DEF-123_xyz',
            clientId: 'cid-1',
            leagueId: '018592924',
            leagueName: 'liga Xixarito',
        });
    });

    test('el texto codificado no lleva caracteres que haya que escapar en una URL', () => {
        expect(codificarEmparejamiento(datos)).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('aguanta acentos y eñes en el nombre de la liga', () => {
        const codificado = codificarEmparejamiento({ ...datos, leagueName: 'Peña Ñandú ⚽' });
        expect(descodificarEmparejamiento(codificado).leagueName).toBe('Peña Ñandú ⚽');
    });

    test('sin refresh token no se puede emparejar', () => {
        expect(() => codificarEmparejamiento({ leagueId: '1' })).toThrow();
    });

    test('devuelve null ante basura, en vez de reventar', () => {
        // Llega de la barra de direcciones: puede ser cualquier cosa.
        expect(descodificarEmparejamiento('no-es-base64-%%%')).toBeNull();
        expect(descodificarEmparejamiento('')).toBeNull();
        expect(descodificarEmparejamiento(null)).toBeNull();
        expect(descodificarEmparejamiento(btoa('{"v":1}').replace(/=+$/, ''))).toBeNull();
    });

    test('rechaza una versión que no conoce', () => {
        const futuro = btoa(JSON.stringify({ v: 99, rt: 'x' })).replace(/=+$/, '');
        expect(descodificarEmparejamiento(futuro)).toBeNull();
    });

    test('lee el hash del enlace', () => {
        const enlace = construirEnlaceEmparejamiento('https://ejemplo.app/', datos);
        const hash = enlace.slice(enlace.indexOf('#'));
        expect(leerEmparejamientoDeHash(hash).refreshToken).toBe(datos.refreshToken);
        expect(leerEmparejamientoDeHash('#otracosa=1')).toBeNull();
        expect(leerEmparejamientoDeHash('')).toBeNull();
    });

    test('el enlace deja el payload tras la almohadilla, que no viaja al servidor', () => {
        const enlace = construirEnlaceEmparejamiento('https://ejemplo.app', datos);
        expect(enlace.startsWith('https://ejemplo.app/#pair=')).toBe(true);
        expect(enlace.split('#')[0]).not.toContain(datos.refreshToken);
    });
});

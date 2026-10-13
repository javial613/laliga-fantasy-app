/**
 * El emparejamiento del móvil tiene un fallo fácil de cometer y difícil de
 * ver: si la sesión importada no recuerda con qué cliente se emitió, la
 * primera renovación la hace con otro distinto, LaLiga responde
 * invalid_grant y el móvil se queda fuera una hora después de entrar.
 */
import authService from '../services/authService';
import { useAuthStore } from './authStore';

jest.mock('../services/authService', () => ({
    __esModule: true,
    default: {
        AUTH_CONFIG: { CLIENT_ID: 'cliente-por-defecto' },
        refreshToken: jest.fn(),
        buildLoginPayload: jest.fn((t) => ({ tokens: t, user: { userId: '1' } })),
        fetchCurrentUserProfile: jest.fn().mockResolvedValue(null),
        isTokenExpired: jest.fn().mockReturnValue(false),
        calculateTokenExpiration: jest.fn(),
    },
}));
jest.mock('../services/tokenStorage', () => ({
    __esModule: true,
    default: { save: jest.fn().mockResolvedValue(undefined), load: jest.fn(() => ({})), clear: jest.fn() },
}));
jest.mock('../services/tokenPersistence', () => ({
    __esModule: true,
    default: { saveTokens: jest.fn(), loadTokens: jest.fn() },
}));

describe('importarEmparejamiento', () => {
    beforeEach(() => {
        // CRA reinicia los mocks antes de cada test (resetMocks), así que las
        // implementaciones hay que darlas aquí y no al declarar el módulo.
        authService.AUTH_CONFIG = { CLIENT_ID: 'cliente-por-defecto' };
        authService.buildLoginPayload.mockImplementation((t) => ({ tokens: t, user: { userId: '1' } }));
        authService.fetchCurrentUserProfile.mockResolvedValue(null);
        authService.isTokenExpired.mockReturnValue(false);
        useAuthStore.setState({ isAuthenticated: false, user: null, tokens: null, leagueId: null });
    });

    test('renueva con el cliente que venía en el QR', async () => {
        authService.refreshToken.mockResolvedValue({ id_token: 'id', refresh_token: 'nuevo' });
        await useAuthStore.getState().importarEmparejamiento({
            refreshToken: 'rt', clientId: 'cliente-del-qr', leagueId: '018592924', leagueName: 'Xixarito',
        });
        expect(authService.refreshToken).toHaveBeenCalledWith('rt', 'cliente-del-qr');
    });

    test('guarda el cliente junto a los tokens, para las renovaciones siguientes', async () => {
        authService.refreshToken.mockResolvedValue({ id_token: 'id', refresh_token: 'nuevo' });
        await useAuthStore.getState().importarEmparejamiento({ refreshToken: 'rt', clientId: 'cliente-del-qr' });
        expect(authService.buildLoginPayload).toHaveBeenCalledWith(
            expect.objectContaining({ client_id: 'cliente-del-qr' })
        );
    });

    test('sin cliente en el QR, usa el de por defecto y también lo guarda', async () => {
        authService.refreshToken.mockResolvedValue({ id_token: 'id' });
        await useAuthStore.getState().importarEmparejamiento({ refreshToken: 'rt' });
        expect(authService.refreshToken).toHaveBeenCalledWith('rt', 'cliente-por-defecto');
        expect(authService.buildLoginPayload).toHaveBeenCalledWith(
            expect.objectContaining({ client_id: 'cliente-por-defecto' })
        );
    });

    test('deja la liga seleccionada', async () => {
        authService.refreshToken.mockResolvedValue({ id_token: 'id' });
        await useAuthStore.getState().importarEmparejamiento({
            refreshToken: 'rt', clientId: 'c', leagueId: '018592924', leagueName: 'Xixarito',
        });
        expect(useAuthStore.getState().leagueId).toBe('018592924');
    });

    test('si LaLiga rechaza el código, no abre sesión ni revienta', async () => {
        authService.refreshToken.mockRejectedValue(new Error('invalid_grant'));
        await expect(useAuthStore.getState().importarEmparejamiento({ refreshToken: 'caducado' }))
            .resolves.toBe(false);
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
});

describe('refreshToken: cliente emisor', () => {
    beforeEach(() => {
        authService.AUTH_CONFIG = {
            CLIENT_ID: 'web', OAUTH_CLIENT_ID: 'nativo', EMAIL_CLIENT_ID: 'email',
        };
        authService.isTokenExpired.mockReturnValue(true);
        authService.calculateTokenExpiration.mockReturnValue(Math.floor(Date.now() / 1000) + 3600);
        useAuthStore.setState({
            isAuthenticated: true, user: { userId: '1' }, inflightRefresh: null,
            tokens: { access_token: 'viejo', refresh_token: 'rt' },
        });
    });

    test('si el cliente guardado ya no vale, prueba los otros conocidos', async () => {
        // Sesión sin client_id: es el caso de las importadas antes del arreglo.
        authService.refreshToken
            .mockRejectedValueOnce(new Error('invalid_grant'))
            .mockResolvedValueOnce({ id_token: 'id', refresh_token: 'rt2' });

        await useAuthStore.getState().refreshToken();

        expect(authService.refreshToken).toHaveBeenCalledTimes(2);
        // Y recuerda el que funcionó, para no tantear en cada renovación.
        expect(useAuthStore.getState().tokens.client_id).toBe('web');
    });

    test('ante un fallo de red no tantea con otros clientes', async () => {
        authService.refreshToken.mockRejectedValue(new Error('Failed to fetch'));
        await expect(useAuthStore.getState().refreshToken()).rejects.toThrow();
        expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });
});

describe('un fallo pasajero no debe cerrar la sesión', () => {
    beforeEach(() => {
        authService.AUTH_CONFIG = { CLIENT_ID: 'web', OAUTH_CLIENT_ID: 'nativo', EMAIL_CLIENT_ID: 'email' };
        authService.isTokenExpired.mockReturnValue(true);
        useAuthStore.setState({
            isAuthenticated: true, user: { userId: '1' }, inflightRefresh: null,
            leagueId: '018592924', leagueName: 'Xixarito', hasSelectedLeague: true,
            tokens: { access_token: 'viejo', refresh_token: 'rt', client_id: 'nativo' },
        });
    });

    test('sin cobertura se conserva la liga y la sesión', async () => {
        authService.refreshToken.mockRejectedValue(new Error('Failed to fetch'));

        await expect(useAuthStore.getState().refreshToken()).rejects.toThrow();

        const estado = useAuthStore.getState();
        expect(estado.leagueId).toBe('018592924');
        expect(estado.hasSelectedLeague).toBe(true);
        expect(estado.isAuthenticated).toBe(true);
    });

    test('si la sesión ya no vale de verdad, se avisa pero tampoco se pierde la liga', async () => {
        authService.refreshToken.mockRejectedValue(new Error('invalid_grant'));

        await expect(useAuthStore.getState().refreshToken()).rejects.toThrow(/caducado|válida/i);

        expect(useAuthStore.getState().leagueId).toBe('018592924');
    });
});

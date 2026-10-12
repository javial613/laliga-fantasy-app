/**
 * Inicio de sesión interactivo contra LaLiga (navegador del sistema + PKCE).
 *
 * Lo usan dos sitios: la pantalla de login y el emparejamiento del móvil.
 * El segundo necesita una sesión *aparte* de la del Mac —el proveedor rota el
 * refresh token en cada uso y dos aparatos con la misma sesión se echan el
 * uno al otro—, y cada login interactivo abre una cadena independiente.
 *
 * Devuelve los tokens tal cual: quién los guarda (o no) es cosa de quien llama.
 */

import authService from './authService';
import * as pkce from '../utils/pkce';

export const sePuedeIniciarSesionInteractiva = () =>
    typeof window !== 'undefined'
    && window.electronAPI !== undefined
    && typeof window.electronAPI.startOAuthLogin === 'function';

/**
 * @returns {Promise<{cancelled:boolean, tokens?:Object}>}
 * @throws si el flujo falla (el motivo va en el mensaje, ya en castellano)
 */
export const obtenerTokensInteractivo = async () => {
    if (!sePuedeIniciarSesionInteractiva()) {
        throw new Error('El inicio de sesión automático solo funciona en la app de escritorio.');
    }

    const verifier = pkce.generateVerifier();
    const challenge = await pkce.challengeFromVerifier(verifier);
    const state = pkce.randomState();
    const redirectUri = authService.AUTH_CONFIG.REDIRECT_URI;
    const authorizeUrl = authService.buildAuthorizeUrl({
        redirectUri,
        codeChallenge: challenge,
        state,
    });

    const resultado = await window.electronAPI.startOAuthLogin({ authorizeUrl, redirectUri, state });
    if (resultado?.cancelled) return { cancelled: true };
    if (!resultado?.success || !resultado.code) {
        throw new Error(resultado?.error || 'No se pudo completar el inicio de sesión');
    }

    const tokens = await authService.exchangeCodeForTokens({
        code: resultado.code,
        codeVerifier: verifier,
        redirectUri,
    });
    return { cancelled: false, tokens };
};

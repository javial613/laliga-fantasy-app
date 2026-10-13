import React, { useCallback, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, ShieldAlert, RefreshCw, EyeOff, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { obtenerTokensInteractivo, sePuedeIniciarSesionInteractiva } from '../../services/interactiveLogin';
import { construirEnlaceEmparejamiento } from '../../utils/pairingPayload';

// Dirección pública de la app. Se puede cambiar sin tocar el código.
const WEB_URL = process.env.REACT_APP_WEB_URL || 'https://laliga-fantasy-fawn.vercel.app';

/**
 * Emparejamiento del móvil.
 *
 * Pide una sesión NUEVA a LaLiga y la mete en un QR. No se reutiliza la del
 * Mac a propósito: el proveedor invalida el refresh token en cuanto se usa,
 * así que dos aparatos compartiéndolo se irían cerrando la sesión el uno al
 * otro. Con una cadena propia para el móvil, cada uno va por su lado.
 *
 * El enlace lleva la sesión detrás de `#`, que el navegador no manda al
 * servidor, así que no queda escrita en ningún registro.
 */
const PairPhone = () => {
    const leagueId = useAuthStore((state) => state.leagueId);
    const leagueName = useAuthStore((state) => state.leagueName);

    const [qr, setQr] = useState(null);
    const [enlace, setEnlace] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);

    const disponible = sePuedeIniciarSesionInteractiva();

    const generar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const { cancelled, tokens } = await obtenerTokensInteractivo();
            if (cancelled) return;
            if (!tokens?.refresh_token) {
                throw new Error('LaLiga no devolvió una sesión reutilizable. Inténtalo de nuevo.');
            }
            const enlace = construirEnlaceEmparejamiento(WEB_URL, {
                refreshToken: tokens.refresh_token,
                clientId: tokens.client_id,
                leagueId,
                leagueName,
            });
            // Corrección de errores baja: el contenido es largo y así el
            // dibujo sale menos denso y la cámara lo coge antes.
            const imagen = await QRCode.toDataURL(enlace, {
                errorCorrectionLevel: 'L',
                margin: 2,
                width: 420,
            });
            setQr(imagen);
            setEnlace(enlace);
            setCopiado(false);
        } catch (err) {
            setError(err.message || 'No se pudo generar el código');
        } finally {
            setCargando(false);
        }
    }, [leagueId, leagueName]);

    const copiar = async () => {
        if (!enlace) return;
        try {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 4000);
        } catch (err) {
            setError('No se pudo copiar. Escanea el QR con la cámara.');
        }
    };

    if (!disponible) return null;

    return (
        <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conectar móvil</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Abre <span className="font-mono text-xs break-all">{WEB_URL}</span> en el móvil y
                añádela a la pantalla de inicio. Después genera el código de abajo para entrar.
            </p>

            {!qr && (
                <button
                    type="button"
                    onClick={generar}
                    disabled={cargando}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60"
                >
                    {cargando
                        ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando…</>
                        : <><Smartphone className="w-4 h-4" aria-hidden="true" /> Generar código</>}
                </button>
            )}

            {cargando && !qr && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Se abrirá el navegador para iniciar sesión. Es una sesión aparte para el móvil,
                    así no se cierra la de este ordenador.
                </p>
            )}

            {error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {qr && (
                <div className="mt-2">
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                            Este código <strong>es tu sesión</strong>. Quien lo escanee entra en tu
                            cuenta. No lo compartas ni le hagas una captura que acabe en otro sitio.
                        </span>
                    </div>

                    <img
                        src={qr}
                        alt="Código QR para conectar el móvil"
                        className="w-[320px] max-w-full rounded-lg bg-white p-2"
                    />

                    <p className="mt-2 max-w-[420px] text-xs text-gray-500 dark:text-gray-400">
                        En el iPhone, abre la app <strong>desde su icono</strong> de la pantalla de
                        inicio y pega ahí el enlace. Si escaneas el QR con la cámara, la sesión se
                        queda en Safari, que guarda sus datos aparte del icono, y este seguirá
                        pidiéndote entrar.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={copiar} className="btn-primary flex items-center gap-2">
                            {copiado
                                ? <><Check className="w-4 h-4" aria-hidden="true" /> Copiado</>
                                : <><Copy className="w-4 h-4" aria-hidden="true" /> Copiar enlace</>}
                        </button>
                        <button type="button" onClick={() => { setQr(null); setEnlace(null); }} className="btn-secondary flex items-center gap-2">
                            <EyeOff className="w-4 h-4" aria-hidden="true" /> Ocultar
                        </button>
                        <button type="button" onClick={generar} disabled={cargando} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
                            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" /> Generar otro
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PairPhone;

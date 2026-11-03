import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useAutoSellStore } from '../../stores/autoSellStore';
import { MAX_POR_TANDA } from '../../utils/autoVenta';
import { formatCurrency } from '../../utils/helpers';

/**
 * Interruptor de la venta automática de fichajes.
 *
 * Va apagado de serie: es una acción que ocurre sin que estés mirando, y
 * nadie debería encontrársela encendida sin haberla pedido.
 */
const AutoSell = () => {
    const activa = useAutoSellStore((s) => s.activa);
    const ultimaVenta = useAutoSellStore((s) => s.ultimaVenta);
    const setActiva = useAutoSellStore((s) => s.setActiva);
    const maximoPorTanda = MAX_POR_TANDA;

    const alternar = () => setActiva(!activa);

    return (
        <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Vender los fichajes al momento
                </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Cuando entre un jugador nuevo en tu plantilla, se pone a la venta solo, por su
                valor de mercado. Da igual cómo llegue: cláusula pagada, puja ganada de madrugada
                u oferta aceptada por otro manager.
            </p>

            <button
                type="button"
                onClick={alternar}
                aria-pressed={activa}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border-2 transition-colors ${
                    activa
                        ? 'border-green-400 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200'
                        : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
            >
                <Zap className="w-4 h-4" aria-hidden="true" />
                {activa ? 'Activada' : 'Desactivada'}
            </button>

            {activa && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p>
                            Solo funciona con la app abierta: comprueba tu plantilla cada medio
                            minuto. Si fichas de madrugada con todo cerrado, se anunciará la
                            próxima vez que abras.
                        </p>
                        <p className="mt-1">
                            Si aparecieran más de {maximoPorTanda} jugadores nuevos de golpe, se
                            detiene sola y te avisa: eso no es un fichaje, es un fallo.
                        </p>
                    </div>
                </div>
            )}

            {ultimaVenta && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Última: <strong>{ultimaVenta.nombre}</strong> por {formatCurrency(ultimaVenta.precio)}.
                </p>
            )}
        </div>
    );
};

export default AutoSell;

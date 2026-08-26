import React from 'react';
import { CheckCircle2, MinusCircle } from 'lucide-react';

/**
 * Probabilidad de ser titular en la próxima jornada.
 *
 * Solo se pinta si hay dato de scraping real (ver utils/starterProbabilities):
 * en caso contrario no se muestra nada, que es más útil que una cifra inventada
 * cuando se está decidiendo un fichaje.
 *
 * El porcentaje puede faltar aunque se sepa si es titular, porque la fuente no
 * siempre lo publica; entonces se muestra solo la condición.
 */
const StarterProbability = ({ playerId, probabilidades, className = '' }) => {
    const dato = playerId != null ? probabilidades?.get?.(String(playerId)) : null;
    if (!dato) return null;

    const { isStarter, probability } = dato;
    const Icono = isStarter ? CheckCircle2 : MinusCircle;

    return (
        <div className={`flex items-center gap-1.5 text-xs min-w-0 ${className}`}>
            <Icono
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isStarter ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                }`}
            />
            <span className={isStarter
                ? 'text-green-700 dark:text-green-400 font-medium'
                : 'text-gray-500 dark:text-gray-400'}>
                {isStarter ? 'Titular' : 'Suplente'}
            </span>
            {probability != null && (
                <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                        probability >= 75
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : probability >= 50
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-400'
                    }`}
                >
                    {Math.round(probability)}%
                </span>
            )}
        </div>
    );
};

export default StarterProbability;

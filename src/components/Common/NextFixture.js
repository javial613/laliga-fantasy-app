import React from 'react';

/**
 * Rival de la próxima jornada alineable de un jugador, con la condición de
 * local.
 *
 * `nextFixtures` es lo que devuelve useNextFixtures; se pasa por props en vez
 * de llamar al hook aquí para no abrir una suscripción de React Query por cada
 * tarjeta de una lista larga.
 *
 * Dos variantes:
 *  - "card" (por defecto): fichas y listas sobre fondo claro/oscuro. Incluye el
 *    número de jornada, que importa porque esta línea salta a la jornada
 *    siguiente en cuanto la actual arranca.
 *  - "pitch": bajo los jugadores del campo. Va sobre césped verde y compite por
 *    112px de ancho con el nombre y la tendencia, así que usa píldora oscura,
 *    texto claro y omite la jornada — que se indica una sola vez en la cabecera
 *    de la sección en vez de repetirse once veces.
 */
const NextFixture = ({ teamId, nextFixtures, className = '', variant = 'card' }) => {
    const fixture = teamId != null ? nextFixtures?.fixtures?.get(String(teamId)) : null;
    const opponent = fixture?.opponent;
    if (!opponent) return null;

    const opponentName = opponent.shortName || opponent.name;
    if (!opponentName) return null;

    const { isHome } = fixture;
    const { weekNumber } = nextFixtures;

    if (variant === 'pitch') {
        return (
            <div
                className={`max-w-full text-[9px] sm:text-[10px] font-bold drop-shadow-md bg-black/40 px-1 rounded flex items-center justify-center gap-1 ${className}`}
            >
                {opponent.badgeColor && (
                    <img
                        src={opponent.badgeColor}
                        alt=""
                        className="w-2.5 h-2.5 object-contain flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                )}
                <span className="truncate text-white/90">{opponentName}</span>
                <span className={`flex-shrink-0 ${isHome ? 'text-green-300' : 'text-amber-300'}`}>
                    {isHome ? 'Casa' : 'Fuera'}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 text-xs min-w-0 ${className}`}>
            {weekNumber != null && (
                <span className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400 text-[10px] font-semibold flex-shrink-0">
                    J{weekNumber}
                </span>
            )}
            {opponent.badgeColor && (
                <img
                    src={opponent.badgeColor}
                    alt=""
                    className="w-4 h-4 object-contain flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            )}
            <span className="text-gray-600 dark:text-gray-300 truncate">
                {opponentName}
            </span>
            <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                    isHome
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
            >
                {isHome ? 'Casa' : 'Fuera'}
            </span>
        </div>
    );
};

export default NextFixture;

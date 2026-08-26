import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { fantasyAPI } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { getClauseTimeRemaining } from '../../utils/clauseUtils';
import { formatCurrency } from '../../utils/helpers';

const DIA_MS = 24 * 60 * 60 * 1000;
const AVISAR_DESDE = 2 * DIA_MS;

/**
 * Aviso de protección de cláusula a punto de caducar.
 *
 * Mientras la protección está activa nadie puede pagar la cláusula de un
 * jugador. Al vencer queda expuesto, así que interesa saberlo con antelación
 * para poder blindarlo o subir la cláusula antes, no después.
 *
 * Solo aparece con menos de dos días por delante: avisar con una semana sería
 * ruido permanente, y avisar al vencer llegaría tarde.
 */
const ClauseProtectionBanner = ({ teamId }) => {
    const leagueId = useAuthStore((state) => state.leagueId);

    const { data: teamData } = useQuery({
        queryKey: ['teamData', leagueId, teamId],
        queryFn: () => fantasyAPI.getTeamData(leagueId, teamId),
        enabled: !!leagueId && !!teamId,
        staleTime: 5 * 60 * 1000,
    });

    const enRiesgo = useMemo(() => {
        const payload = teamData?.data || teamData;
        const jugadores = payload?.players || [];
        const ahora = Date.now();

        return jugadores
            .map((pt) => {
                const fin = pt?.buyoutClauseLockedEndTime;
                if (!fin) return null;
                const restante = new Date(fin).getTime() - ahora;
                // Ya vencida: no es un aviso, es un hecho consumado, y saldría
                // permanentemente para media plantilla.
                if (restante <= 0 || restante > AVISAR_DESDE) return null;
                return {
                    id: pt.playerMaster?.id,
                    nombre: pt.playerMaster?.nickname || pt.playerMaster?.name || 'Jugador',
                    clausula: pt.buyoutClause,
                    restanteMs: restante,
                    texto: getClauseTimeRemaining(fin),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.restanteMs - b.restanteMs);
    }, [teamData]);

    if (enRiesgo.length === 0) return null;

    return (
        <div
            role="status"
            className="card border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4"
        >
            <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                <h3 className="font-semibold text-orange-800 dark:text-orange-300">
                    Protección de cláusula a punto de acabar ({enRiesgo.length})
                </h3>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {enRiesgo.map((j) => (
                    <li key={j.id || j.nombre} className="flex items-center gap-1.5">
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{j.nombre}</span>
                        <span className={j.restanteMs <= DIA_MS
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : 'text-orange-700 dark:text-orange-400'}
                        >
                            · queda {j.texto}
                        </span>
                        {j.clausula > 0 && (
                            <span className="text-gray-500 dark:text-gray-400">
                                ({formatCurrency(j.clausula)})
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ClauseProtectionBanner;

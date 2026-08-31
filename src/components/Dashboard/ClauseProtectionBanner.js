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
 * Aviso de jugadores propios expuestos a que les paguen la cláusula.
 *
 * Distingue dos situaciones, porque exigen reacciones distintas:
 *  - **Sin protección**: cualquiera puede llevárselo ahora mismo pagando su
 *    cláusula. Es lo más urgente y va primero.
 *  - **A punto de acabar** (menos de dos días): todavía hay margen para
 *    blindarlo o subir la cláusula. Avisar con una semana sería ruido
 *    permanente; avisar al vencer llegaría tarde.
 *
 * En ambos casos se muestra el importe, que es lo que decide si conviene
 * actuar o asumir el riesgo.
 */
const ClauseProtectionBanner = ({ teamId }) => {
    const leagueId = useAuthStore((state) => state.leagueId);

    const { data: teamData } = useQuery({
        queryKey: ['teamData', leagueId, teamId],
        queryFn: () => fantasyAPI.getTeamData(leagueId, teamId),
        enabled: !!leagueId && !!teamId,
        staleTime: 5 * 60 * 1000,
    });

    const { abiertos, porVencer } = useMemo(() => {
        const payload = teamData?.data || teamData;
        const jugadores = payload?.players || [];
        const ahora = Date.now();
        const abierta = [];
        const proxima = [];

        for (const pt of jugadores) {
            const clausula = pt?.buyoutClause;
            if (!(clausula > 0)) continue;
            const fin = pt?.buyoutClauseLockedEndTime;
            const restante = fin ? new Date(fin).getTime() - ahora : 0;
            const ficha = {
                id: pt.playerMaster?.id,
                nombre: pt.playerMaster?.nickname || pt.playerMaster?.name || 'Jugador',
                clausula,
                restanteMs: restante,
                texto: fin ? getClauseTimeRemaining(fin) : null,
            };
            // Sin fecha de bloqueo o ya vencida: la cláusula está abierta.
            if (restante <= 0) abierta.push(ficha);
            else if (restante <= AVISAR_DESDE) proxima.push(ficha);
        }

        // Los abiertos, por cláusula más barata: son los que se pueden llevar
        // más fácilmente. Los que van a vencer, por urgencia.
        abierta.sort((a, b) => a.clausula - b.clausula);
        proxima.sort((a, b) => a.restanteMs - b.restanteMs);
        return { abiertos: abierta, porVencer: proxima };
    }, [teamData]);

    if (abiertos.length === 0 && porVencer.length === 0) return null;

    return (
        <div
            role="status"
            className="card border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4"
        >
            <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                <h3 className="font-semibold text-orange-800 dark:text-orange-300">
                    Cláusulas expuestas ({abiertos.length + porVencer.length})
                </h3>
            </div>

            {abiertos.length > 0 && (
                <div className="mb-2">
                    <p className="text-xs uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1">
                        Te los pueden clausular ahora mismo ({abiertos.length})
                    </p>
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {abiertos.map((j) => (
                            <li key={j.id || j.nombre} className="flex items-center gap-1.5">
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{j.nombre}</span>
                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                    · {formatCurrency(j.clausula)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {porVencer.length > 0 && (
                <div>
                    <p className="text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400 font-semibold mb-1">
                        Protección a punto de acabar ({porVencer.length})
                    </p>
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {porVencer.map((j) => (
                            <li key={j.id || j.nombre} className="flex items-center gap-1.5">
                                <span className="text-gray-900 dark:text-gray-100 font-medium">{j.nombre}</span>
                                <span className={j.restanteMs <= DIA_MS
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : 'text-orange-700 dark:text-orange-400'}
                                >
                                    · queda {j.texto}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    ({formatCurrency(j.clausula)})
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ClauseProtectionBanner;

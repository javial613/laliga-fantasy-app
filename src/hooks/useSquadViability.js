import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAllTeamsData, extractTeamPlayers } from '../utils/fetchAllTeamsData';
import { analizarPlantilla } from '../utils/alineacionPosible';

/**
 * Para cada equipo de la liga: cuántos jugadores tiene y si se le puede dejar
 * sin poder alinear pagando cláusulas (ver alineacionPosible).
 *
 * Reutiliza la caché de plantillas que ya llenan Cláusulas y el cálculo de
 * saldos, así que no añade peticiones propias salvo que no haya nada cacheado.
 *
 * `limite` es el cierre de cláusulas (24 h antes de la jornada): con él entran
 * en el cálculo los que todavía están protegidos pero se desbloquean a tiempo.
 */
const useSquadViability = (leagueId, standings, limite = null) => {
    const queryClient = useQueryClient();
    const [porEquipo, setPorEquipo] = useState(() => new Map());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelado = false;
        if (!leagueId || !standings) return undefined;

        (async () => {
            setIsLoading(true);
            try {
                const datos = await fetchAllTeamsData(queryClient, leagueId, standings);
                if (cancelado) return;

                const ahora = Date.now();
                const mapa = new Map();
                for (const [teamId, { teamData }] of datos) {
                    const jugadores = extractTeamPlayers(teamData).map((pt) => ({
                        playerId: pt.playerMaster?.id,
                        nombre: pt.playerMaster?.nickname || pt.playerMaster?.name || 'Jugador',
                        positionId: pt.playerMaster?.positionId,
                        clausula: pt.buyoutClause || 0,
                        lockedUntil: pt.buyoutClauseLockedEndTime || null,
                    }));
                    mapa.set(String(teamId), analizarPlantilla(jugadores, { ahora, limite }));
                }
                setPorEquipo(mapa);
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        })();

        return () => { cancelado = true; };
    }, [leagueId, standings, queryClient, limite]);

    return { porEquipo, isLoading };
};

export default useSquadViability;

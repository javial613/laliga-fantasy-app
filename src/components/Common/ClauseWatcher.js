import { useQuery } from '@tanstack/react-query';
import { fantasyAPI } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import useClauseCosts from '../../hooks/useClauseCosts';

/**
 * Vigilante de subidas de cláusula, montado a nivel de aplicación.
 *
 * Estas subidas solo se pueden detectar comparando el valor de las cláusulas
 * entre dos momentos del mismo día (ver utils/clauseTracker). Si el seguimiento
 * viviera únicamente en la pantalla de Equipos, haría falta entrar ahí dos
 * veces el mismo día para detectar algo; montándolo aquí basta con tener la app
 * abierta, esté donde esté el usuario, y las instantáneas se van tomando solas.
 *
 * No pinta nada: es solo el enganche que mantiene vivo el seguimiento.
 */
const ClauseWatcher = () => {
    const leagueId = useAuthStore((state) => state.leagueId);

    const { data: standings } = useQuery({
        queryKey: ['standings', leagueId],
        queryFn: () => fantasyAPI.getLeagueRanking(leagueId),
        enabled: !!leagueId,
        staleTime: 5 * 60 * 1000,
    });

    useClauseCosts(leagueId, standings, null);

    return null;
};

export default ClauseWatcher;

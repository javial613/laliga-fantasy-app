import { useQuery } from '@tanstack/react-query';
import { fantasyAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { extractArray } from '../utils/helpers';

/**
 * Equipo del usuario dentro de la liga activa.
 *
 * La API no ofrece un "mi equipo": hay que buscarlo en la clasificación
 * cruzando el id de usuario, que según el endpoint aparece en sitios
 * distintos.
 */
const useMyTeamId = () => {
    const leagueId = useAuthStore((state) => state.leagueId);
    const user = useAuthStore((state) => state.user);

    const { data: standings, isLoading } = useQuery({
        queryKey: ['standings', leagueId],
        queryFn: () => fantasyAPI.getLeagueRanking(leagueId),
        enabled: !!leagueId,
        staleTime: 5 * 60 * 1000,
    });

    const miEntrada = extractArray(standings).find((item) => {
        const idDelEquipo = item.userId || item.team?.userId || item.team?.manager?.id || item.managerId;
        const idActual = user?.userId || user?.id;
        if (!idDelEquipo || !idActual) return false;
        return idDelEquipo.toString() === idActual.toString();
    });

    return {
        teamId: miEntrada?.teamId || miEntrada?.team?.id || miEntrada?.id || null,
        miEquipo: miEntrada || null,
        leagueId,
        isLoading,
    };
};

export default useMyTeamId;

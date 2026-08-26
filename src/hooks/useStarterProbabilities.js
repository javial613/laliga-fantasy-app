import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { preloadTeamLineups } from '../services/oncesProbles';
import { construirIndiceTitularidad, slugsParaEquipos } from '../utils/starterProbabilities';

/**
 * Probabilidad de titularidad por jugador, para los equipos que se indiquen.
 *
 * Cada equipo es una petición de scraping, así que solo se piden los equipos
 * realmente presentes en pantalla en vez de los veinte de la liga: en un
 * mercado con jugadores de ocho equipos, son ocho peticiones y no veinte. El
 * servicio subyacente ya cachea 30 minutos por equipo y comparte las peticiones
 * en vuelo, de modo que pasar por Onces Probables y por Mercado no duplica
 * trabajo.
 *
 * @param {Array<string|number>} teamIds ids de equipo de LaLiga
 */
const useStarterProbabilities = (teamIds) => {
    const slugs = useMemo(() => slugsParaEquipos(teamIds).sort(), [teamIds]);

    const { data } = useQuery({
        queryKey: ['starterProbabilities', slugs],
        queryFn: async () => {
            const { successful } = await preloadTeamLineups(slugs);
            return construirIndiceTitularidad(successful);
        },
        enabled: slugs.length > 0,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: false,
    });

    return data || null;
};

export default useStarterProbabilities;

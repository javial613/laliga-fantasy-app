import { useQuery } from '@tanstack/react-query';

// Fichero que publica el vigilante que corre en GitHub Actions cada hora.
// Se puede apuntar a otro sitio con REACT_APP_CLAUSE_WATCH_URL.
const URL_POR_DEFECTO =
    'https://raw.githubusercontent.com/javial613/laliga-fantasy-app/main/data/clause-watch.json';

/**
 * Gasto en subidas de cláusula detectado por el vigilante remoto.
 *
 * El rastreo local solo ve lo que ocurre mientras la app está abierta, así que
 * se pierde todo lo que pasa de madrugada o los días que no se usa. El
 * vigilante corre cada hora en GitHub y no tiene ese hueco: cuando sus datos
 * están disponibles, mandan sobre los locales.
 */
const useRemoteClauseData = (leagueId) => {
    const url = process.env.REACT_APP_CLAUSE_WATCH_URL || URL_POR_DEFECTO;

    const { data } = useQuery({
        queryKey: ['clauseWatchRemoto', url],
        queryFn: async () => {
            const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        },
        enabled: Boolean(url),
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: false,
    });

    // Un fichero de otra liga no sirve: mejor ignorarlo que mezclar saldos.
    if (!data || (leagueId && data.leagueId && String(data.leagueId) !== String(leagueId))) {
        return null;
    }

    return {
        costes: data.costes || {},
        historial: data.historial || [],
        tomadaEn: data.tomadaEn || null,
        jugadores: data.jugadores ? Object.keys(data.jugadores).length : 0,
    };
};

export default useRemoteClauseData;

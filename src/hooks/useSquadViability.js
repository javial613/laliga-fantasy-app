import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAllTeamsData, extractTeamPlayers } from '../utils/fetchAllTeamsData';
import { analizarPlantilla, consejosParaProtegerse } from '../utils/alineacionPosible';

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
const useSquadViability = (leagueId, standings, limite = null, miTeamId = null) => {
    const queryClient = useQueryClient();

    // Los consejos solo se calculan para el equipo propio: simular fichajes en
    // las cuatro posiciones de cada rival cuesta y no sirve de nada.
    const analizar = useCallback((jugadores, teamId, ahora, cierre) => {
        const analisis = analizarPlantilla(jugadores, { ahora, limite: cierre });
        const esMio = miTeamId != null && String(teamId) === String(miTeamId);
        if (!esMio) return analisis;
        return { ...analisis, consejos: consejosParaProtegerse(jugadores, { ahora, limite: cierre }) };
    }, [miTeamId]);
    const [porEquipo, setPorEquipo] = useState(() => new Map());
    const [isLoading, setIsLoading] = useState(false);
    // Las protecciones vencen a una hora exacta, así que el análisis se rehace
    // cada minuto: si no, el aviso sigue diciendo "todavía no" cuando la
    // cláusula ya se abrió hace rato.
    const [tic, setTic] = useState(0);
    const plantillas = useRef(new Map());

    useEffect(() => {
        const id = setInterval(() => setTic((n) => n + 1), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        let cancelado = false;
        if (!leagueId || !standings) return undefined;

        (async () => {
            setIsLoading(true);
            try {
                const datos = await fetchAllTeamsData(queryClient, leagueId, standings);
                if (cancelado) return;

                const nuevas = new Map();
                for (const [teamId, { teamData }] of datos) {
                    nuevas.set(String(teamId), extractTeamPlayers(teamData).map((pt) => ({
                        playerId: pt.playerMaster?.id,
                        nombre: pt.playerMaster?.nickname || pt.playerMaster?.name || 'Jugador',
                        positionId: pt.playerMaster?.positionId,
                        clausula: pt.buyoutClause || 0,
                        // Para poder juzgar si clausular sale a cuenta: lo que
                        // cuesta frente a lo que vale.
                        valor: pt.playerMaster?.marketValue ?? null,
                        lockedUntil: pt.buyoutClauseLockedEndTime || null,
                    })));
                }
                plantillas.current = nuevas;
                const ahora = Date.now();
                const mapa = new Map();
                for (const [teamId, jugadores] of nuevas) {
                    mapa.set(String(teamId), analizar(jugadores, teamId, ahora, limite));
                }
                setPorEquipo(mapa);
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        })();

        return () => { cancelado = true; };
    }, [leagueId, standings, queryClient, limite, analizar]);

    // Reanálisis periódico sobre las plantillas ya descargadas: no pide nada a
    // la red, solo vuelve a mirar el reloj.
    useEffect(() => {
        if (tic === 0 || plantillas.current.size === 0) return;
        const ahora = Date.now();
        const mapa = new Map();
        for (const [teamId, jugadores] of plantillas.current) {
            mapa.set(String(teamId), analizar(jugadores, teamId, ahora, limite));
        }
        setPorEquipo(mapa);
    }, [tic, limite, analizar]);

    return { porEquipo, isLoading };
};

export default useSquadViability;

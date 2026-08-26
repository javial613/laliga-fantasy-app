import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fantasyAPI } from '../services/api';
import { useCurrentWeek } from './useCurrentWeek';

// Estados de partido de la API: 2 = 1ª parte, 4 = 2ª parte, 7 = finalizado.
// Cualquier valor por debajo significa que aún no ha arrancado.
const MATCH_STATE_FIRST_HALF = 2;
const MATCH_STATE_SECOND_HALF = 4;
const MATCH_STATE_FINISHED = 7;

const EMPTY_RESULT = { fixtures: new Map(), weekNumber: null };

/**
 * El calendario llega como array plano, como {elements:[...]} o envuelto en
 * `data`, según el endpoint y la temporada.
 */
const extractMatches = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.elements)) return response.elements;
    if (Array.isArray(response?.data?.elements)) return response.data.elements;
    return [];
};

const hasMatchStarted = (match) => {
    if (!match) return false;
    const state = match.matchState;
    if (state === MATCH_STATE_FIRST_HALF || state === MATCH_STATE_SECOND_HALF || state === MATCH_STATE_FINISHED) {
        return true;
    }
    // Respaldo por fecha: si la API no informa el estado todavía, un partido
    // con hora de inicio pasada cuenta como empezado.
    const date = match.matchDate || match.date;
    if (!date) return false;
    const parsed = new Date(date).getTime();
    return Number.isFinite(parsed) && parsed <= Date.now();
};

/**
 * Una jornada está "en marcha" en cuanto arranca su primer partido. A partir de
 * ese momento el mercado debe mirar a la jornada siguiente: un jugador fichado
 * ahora ya no entra en la alineación de la jornada en curso.
 */
const hasRoundStarted = (matches) => matches.length > 0 && matches.some(hasMatchStarted);

const buildFixtureMap = (matches) => {
    const map = new Map();

    for (const match of matches) {
        if (!match) continue;
        const local = match.local;
        const visitor = match.visitor;
        const localId = local?.id ?? match.localId;
        const visitorId = visitor?.id ?? match.visitorId;
        const matchDate = match.matchDate || match.date || null;

        if (localId != null && visitor) {
            map.set(String(localId), { opponent: visitor, isHome: true, matchDate });
        }
        if (visitorId != null && local) {
            map.set(String(visitorId), { opponent: local, isHome: false, matchDate });
        }
    }

    return map;
};

/**
 * Rival de la próxima jornada *alineable* por equipo.
 *
 * Devuelve `{ fixtures: Map(teamId -> {opponent, isHome, matchDate}), weekNumber }`.
 *
 * Si la jornada actual ya ha empezado, salta a la siguiente: de nada sirve ver
 * contra quién juega hoy un jugador que, si lo fichas, no vas a poder alinear
 * hasta la jornada que viene. Esa segunda petición solo se lanza en ese caso.
 * Comparte la query key ['matches', week] con Dashboard y Jornadas, así que
 * navegar entre esas pantallas y el Mercado no re-descarga el calendario.
 */
const useNextFixtures = () => {
    const { weekNumber } = useCurrentWeek();

    const { data: currentWeekData } = useQuery({
        queryKey: ['matches', weekNumber],
        queryFn: () => fantasyAPI.getMatchday(weekNumber),
        enabled: !!weekNumber,
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    const currentMatches = useMemo(() => extractMatches(currentWeekData), [currentWeekData]);
    const roundInProgress = hasRoundStarted(currentMatches);
    const followingWeek = roundInProgress && weekNumber ? weekNumber + 1 : null;

    const { data: followingWeekData } = useQuery({
        queryKey: ['matches', followingWeek],
        queryFn: () => fantasyAPI.getMatchday(followingWeek),
        enabled: !!followingWeek,
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    const followingMatches = useMemo(() => extractMatches(followingWeekData), [followingWeekData]);

    return useMemo(() => {
        const matches = roundInProgress ? followingMatches : currentMatches;
        if (matches.length === 0) return EMPTY_RESULT;
        return {
            fixtures: buildFixtureMap(matches),
            weekNumber: roundInProgress ? followingWeek : weekNumber,
        };
    }, [roundInProgress, currentMatches, followingMatches, followingWeek, weekNumber]);
};

export { extractMatches, buildFixtureMap, hasMatchStarted, hasRoundStarted };
export default useNextFixtures;

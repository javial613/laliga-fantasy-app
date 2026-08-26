import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fantasyAPI } from '../services/api';
import { extractArray, readTeamMoney } from '../utils/helpers';
import { buildBudgetLedger, getManagerBalance } from '../utils/teamBudgets';
import useClauseCosts from './useClauseCosts';
import useRemoteClauseData from './useRemoteClauseData';
import { getAjusteManual } from '../utils/ajustesSaldo';

// La pantalla de Actividad se queda en 5 páginas porque solo enseña lo
// reciente; aquí hace falta llegar hasta el principio de la liga, así que el
// tope es mucho más alto y se recorre con pausas para no provocar 429.
const MAX_PAGES = 80;
const PAGE_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Descarga el histórico de actividad entero. Devuelve además `complete`, que
 * es false si se agotó el tope de páginas antes de llegar al final: en ese
 * caso a los saldos les faltan movimientos y no deben presentarse como buenos.
 */
const fetchFullActivity = async (leagueId) => {
    const items = [];
    let complete = false;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        if (page > 0) await sleep(PAGE_DELAY_MS);
        let response;
        try {
            response = await fantasyAPI.getLeagueActivity(leagueId, page);
        } catch (_err) {
            break; // Sin histórico completo: `complete` se queda en false.
        }
        const pageItems = extractArray(response);
        if (pageItems.length === 0) {
            complete = true;
            break;
        }
        items.push(...pageItems);
    }

    return { items, complete };
};

/**
 * Saldo estimado de cada manager de la liga.
 *
 * Se reconstruye desde el presupuesto inicial aplicando el histórico de
 * movimientos (ver utils/teamBudgets), porque la API solo expone el saldo del
 * equipo propio.
 *
 * Como control de calidad, el saldo propio sí se consulta a la API y se
 * compara con el que sale del cálculo: `selfCheck` recoge esa diferencia. Si
 * el modelo se desvía en tu equipo, se está desviando también en los demás, y
 * la UI puede decirlo en vez de presentar cifras inventadas con aire de
 * exactitud.
 *
 * @returns {{ balanceFor: (managerId) => number|undefined, ledger, selfCheck, isLoading }}
 */
const useTeamBudgets = (leagueId, standings, userTeamId) => {
    const queryClient = useQueryClient();

    const nombrePorEquipo = useMemo(() => {
        const map = new Map();
        for (const entry of extractArray(standings)) {
            const teamId = entry.id || entry.team?.id;
            const nombre = entry.team?.manager?.managerName
                || (typeof entry.manager === 'string' ? entry.manager : entry.manager?.managerName)
                || entry.name;
            if (teamId != null && nombre) map.set(String(teamId), nombre);
        }
        return map;
    }, [standings]);

    // Las subidas de cláusula no salen en el histórico: se detectan aparte
    // comparando instantáneas y se restan del saldo calculado.
    const { costePorEquipo: costeLocal, historial: historialLocal, valorPorEquipo } =
        useClauseCosts(leagueId, standings, nombrePorEquipo);

    // El vigilante remoto corre cada hora y no se pierde ni las madrugadas ni
    // los días sin usar la app, así que cuando hay datos suyos mandan sobre el
    // rastreo local. El local queda como respaldo si el remoto no responde.
    const remoto = useRemoteClauseData(leagueId);
    const costeClausulas = remoto ? remoto.costes : costeLocal;
    const historialClausulas = remoto ? remoto.historial : historialLocal;
    const origenClausulas = remoto ? 'vigilante' : 'local';
    const { data, isLoading, dataUpdatedAt } = useQuery({
        queryKey: ['leagueActivityFull', leagueId],
        queryFn: () => fetchFullActivity(leagueId),
        enabled: !!leagueId,
        // Recorrer el histórico entero es caro, así que no se revalida al
        // montar: se recarga cuando caduca o cuando una operación de mercado lo
        // invalida explícitamente (ver utils/cacheInvalidation).
        staleTime: 2 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    // El saldo propio es una sola petición barata y es el dato que el usuario
    // espera ver al día justo después de vender: se revalida siempre al montar
    // en lugar de servirse de una caché de minutos.
    const { data: ownMoney, refetch: refetchOwnMoney } = useQuery({
        queryKey: ['teamMoney', userTeamId],
        queryFn: () => fantasyAPI.getTeamMoney(userTeamId),
        enabled: !!userTeamId,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    // managerId -> teamId, para poder resolver por equipo desde la tabla.
    const managerIdByTeamId = useMemo(() => {
        const map = new Map();
        for (const entry of extractArray(standings)) {
            const teamId = entry.id || entry.team?.id;
            const managerId = entry.userId || entry.team?.userId || entry.team?.manager?.id;
            if (teamId != null && managerId != null) map.set(String(teamId), String(managerId));
        }
        return map;
    }, [standings]);

    // nombre normalizado -> managerId, para rescatar los eventos que llegan sin id.
    const managerIdByName = useMemo(() => {
        const map = new Map();
        for (const entry of extractArray(standings)) {
            const managerId = entry.userId || entry.team?.userId || entry.team?.manager?.id;
            if (managerId == null) continue;
            const names = [
                entry.team?.manager?.managerName,
                typeof entry.manager === 'string' ? entry.manager : entry.manager?.managerName,
                entry.name,
                entry.team?.name,
            ];
            for (const name of names) {
                if (typeof name === 'string' && name.trim()) {
                    map.set(name.trim().toLowerCase(), String(managerId));
                }
            }
        }
        return map;
    }, [standings]);

    const ownManagerId = userTeamId ? managerIdByTeamId.get(String(userTeamId)) : null;

    const ledger = useMemo(() => {
        if (!data) return null;
        return buildBudgetLedger(data.items, {
            historyComplete: data.complete,
            traceManagerId: ownManagerId,
            managerIdByName,
        });
    }, [data, ownManagerId, managerIdByName]);

    const selfCheck = useMemo(() => {
        const real = readTeamMoney(ownMoney);
        if (real == null || !ledger || !userTeamId) return null;
        const managerId = managerIdByTeamId.get(String(userTeamId));
        const base = getManagerBalance(ledger, managerId);
        if (base == null) return null;
        const ajuste = getAjusteManual(nombrePorEquipo.get(String(userTeamId)))?.importe || 0;
        const estimated = base - (costeClausulas[String(userTeamId)] || 0) - ajuste;
        return { real, estimated, diff: estimated - real };
    }, [ownMoney, ledger, userTeamId, managerIdByTeamId, costeClausulas, nombrePorEquipo]);

    const balanceFor = useMemo(() => (teamId) => {
        if (!ledger) return undefined;
        const managerId = managerIdByTeamId.get(String(teamId));
        if (!managerId) return undefined;
        const base = getManagerBalance(ledger, managerId);
        if (base == null) return base;
        const ajuste = getAjusteManual(nombrePorEquipo.get(String(teamId)))?.importe || 0;
        return base - (costeClausulas[String(teamId)] || 0) - ajuste;
    }, [ledger, managerIdByTeamId, costeClausulas, nombrePorEquipo]);

    /** Fuerza la recarga del saldo propio y del histórico. */
    const refreshBudgets = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ['leagueActivityFull', leagueId] });
        await refetchOwnMoney();
    }, [queryClient, leagueId, refetchOwnMoney]);

    // Momento en que se leyó el histórico. Se expone para poder mostrarlo: si
    // valor y saldo vinieran de fotos distintas, el patrimonio sería una mezcla
    // sin sentido, y con la marca a la vista eso deja de ser invisible.
    return { balanceFor, ledger, selfCheck, ownManagerId, costeClausulas, historialClausulas, origenClausulas, remoto, nombrePorEquipo, refreshBudgets, datosDe: dataUpdatedAt || null, managerIdByTeamId, valorPorEquipo, isLoading };
};

export default useTeamBudgets;

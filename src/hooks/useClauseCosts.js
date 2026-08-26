import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAllTeamsData, extractTeamPlayers } from '../utils/fetchAllTeamsData';
import {
    construirInstantanea,
    detectarSubidasDeClausula,
    acumularCostes,
} from '../utils/clauseTracker';

// v2: la v1 cobraba revalorizaciones automáticas como si fueran subidas
// pagadas (ver clauseTracker). Esos importes son irrecuperables, así que se
// cambia de clave para partir de cero en vez de arrastrar cifras falsas.
const V = 'v2';
const KEY_SNAP = (leagueId) => `laliga_clausulas_snapshot_${V}_${leagueId}`;
const KEY_COSTES = (leagueId) => `laliga_clausulas_costes_${V}_${leagueId}`;
// Historial visible de lo detectado, para poder revisar jugador a jugador que
// las subidas cobradas son reales. Se limita para no engordar sin control.
const KEY_HISTORIAL = (leagueId) => `laliga_clausulas_historial_${V}_${leagueId}`;
const MAX_HISTORIAL = 100;

// Cada cuánto se vuelve a fotografiar mientras la app está abierta. Cuantas más
// instantáneas haya dentro de un mismo día, más subidas quedan dentro de un
// intervalo atribuible; con una sola visita diaria casi todos los intervalos
// cruzarían la revalorización nocturna y no se detectaría nada.
const INTERVALO_MS = 45 * 60 * 1000;

const leer = (key, porDefecto) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : porDefecto;
    } catch {
        return porDefecto;
    }
};

const escribir = (key, valor) => {
    try {
        localStorage.setItem(key, JSON.stringify(valor));
    } catch {
        // Sin espacio o modo privado: se pierde el seguimiento, no la app.
    }
};

/**
 * Gasto acumulado por equipo en subidas de cláusula.
 *
 * Estas operaciones no aparecen en el histórico de actividad (ver
 * utils/clauseTracker), así que la única forma de contabilizarlas es mirar cómo
 * cambian las cláusulas entre una sesión y la siguiente. Por eso el resultado
 * es acumulativo y vive en localStorage: cada visita añade lo detectado desde
 * la anterior.
 *
 * Consecuencia importante: **solo se detecta lo que ocurre entre dos visitas**.
 * Las subidas anteriores a la primera instantánea son invisibles y siempre lo
 * serán, porque no hay dato histórico del que deducirlas.
 *
 * @returns {{ costePorEquipo: Object, ultimaDeteccion: Array, listo: boolean }}
 */
const useClauseCosts = (leagueId, standings, nombrePorEquipo) => {
    const queryClient = useQueryClient();
    const [estado, setEstado] = useState({ costePorEquipo: {}, ultimaDeteccion: [], historial: [], valorPorEquipo: {}, listo: false });

    useEffect(() => {
        if (!leagueId || !standings) return;
        let cancelado = false;

        const tomarInstantanea = async () => {
            try {
                const porEquipo = await fetchAllTeamsData(queryClient, leagueId, standings);
                if (cancelado) return;

                const jugadoresPorEquipo = new Map();
                for (const [teamId, { teamData }] of porEquipo) {
                    jugadoresPorEquipo.set(String(teamId), extractTeamPlayers(teamData));
                }

                const instantanea = construirInstantanea(jugadoresPorEquipo);
                if (Object.keys(instantanea).length === 0) return;

                // Valor real de cada plantilla, sumando el valor de mercado de
                // sus jugadores. El campo `teamValue` de la clasificación mide
                // otra cosa: comparado con la app oficial se desvía decenas de
                // millones, y además en direcciones distintas según el equipo,
                // así que no sirve para el patrimonio.
                const valorPorEquipo = {};
                for (const [teamId, jugadores] of jugadoresPorEquipo) {
                    valorPorEquipo[String(teamId)] = (jugadores || []).reduce(
                        (suma, pt) => suma + (pt?.playerMaster?.marketValue || 0), 0);
                }

                const ahora = new Date().toISOString();
                const guardado = leer(KEY_SNAP(leagueId), null);
                const anterior = guardado?.jugadores || null;
                let costes = leer(KEY_COSTES(leagueId), {});
                let historial = leer(KEY_HISTORIAL(leagueId), []);
                let subidas = [];

                if (anterior) {
                    const r = detectarSubidasDeClausula(anterior, instantanea, {
                        desde: guardado?.tomadaEn,
                        hasta: ahora,
                    });
                    subidas = r.subidas.map((x) => ({
                        ...x,
                        fecha: ahora,
                        managerName: nombrePorEquipo?.get?.(String(x.teamId)) || null,
                    }));
                    if (subidas.length > 0) {
                        costes = acumularCostes(costes, subidas);
                        historial = [...subidas, ...historial].slice(0, MAX_HISTORIAL);
                        escribir(KEY_COSTES(leagueId), costes);
                        escribir(KEY_HISTORIAL(leagueId), historial);
                    }
                }

                escribir(KEY_SNAP(leagueId), { tomadaEn: ahora, jugadores: instantanea });
                if (!cancelado) {
                    setEstado({ costePorEquipo: costes, ultimaDeteccion: subidas, historial, valorPorEquipo, listo: true });
                }
            } catch {
                if (!cancelado) setEstado((e) => ({ ...e, listo: true }));
            }
        };

        tomarInstantanea();
        const temporizador = setInterval(tomarInstantanea, INTERVALO_MS);

        return () => {
            cancelado = true;
            clearInterval(temporizador);
        };
    }, [leagueId, standings, queryClient, nombrePorEquipo]);

    return estado;
};

export default useClauseCosts;

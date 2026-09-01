import { useCallback, useEffect, useState } from 'react';

const KEY = (leagueId) => `laliga_clausulas_descartadas_v1_${leagueId}`;

/**
 * Identifica una detección de forma estable entre recargas.
 *
 * Se usan los importes y no la fecha: la fecha es el momento en que el
 * vigilante la detectó, y puede cambiar si el histórico se regenera. La pareja
 * jugador + cláusula anterior + cláusula nueva describe el hecho en sí.
 */
export const claveDeteccion = (d) =>
    `${d?.playerId ?? '?'}|${d?.clauseAnterior ?? '?'}|${d?.clauseActual ?? '?'}`;

const leer = (leagueId) => {
    try {
        const raw = localStorage.getItem(KEY(leagueId));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

/**
 * Detecciones de subida de cláusula descartadas a mano.
 *
 * La detección es heurística y a veces se equivoca; esto permite quitar una
 * suelta sin desactivar el mecanismo entero. Vive en el navegador, no en el
 * vigilante: es un juicio del usuario sobre unos datos compartidos, no un
 * cambio en los datos.
 */
const useDismissedClauseDetections = (leagueId) => {
    const [descartadas, setDescartadas] = useState({});

    useEffect(() => {
        if (leagueId) setDescartadas(leer(leagueId));
    }, [leagueId]);

    const guardar = useCallback((siguiente) => {
        setDescartadas(siguiente);
        try {
            localStorage.setItem(KEY(leagueId), JSON.stringify(siguiente));
        } catch {
            // Sin espacio o modo privado: se pierde al recargar, no se rompe.
        }
    }, [leagueId]);

    const descartar = useCallback((deteccion) => {
        guardar({ ...descartadas, [claveDeteccion(deteccion)]: true });
    }, [descartadas, guardar]);

    const restaurarTodas = useCallback(() => guardar({}), [guardar]);

    return { descartadas, descartar, restaurarTodas };
};

export default useDismissedClauseDetections;

import { useQuery } from '@tanstack/react-query';
import { fantasyAPI } from '../services/api';
import { useCurrentWeek } from './useCurrentWeek';
import { calcularVentanaClausulas, describirLimite } from '../utils/ventanaClausulas';
import { extractArray } from '../utils/helpers';

/** Primer partido de una jornada, que es cuando empieza a contar. */
const primerPartido = (calendario) => {
    const fechas = extractArray(calendario)
        .map((m) => m?.matchDate || m?.date)
        .filter(Boolean)
        .map((f) => new Date(f).getTime())
        .filter((t) => !Number.isNaN(t))
        .sort((a, b) => a - b);
    return fechas[0] ?? null;
};

/**
 * Plazo para pagar cláusulas: cierra 24 h antes del comienzo de la jornada.
 *
 * El inicio sale de /week/current (openingWeekDate). El de la jornada
 * siguiente hace falta para cuando el plazo en curso ya ha vencido, y ese hay
 * que sacarlo del calendario porque ese endpoint solo describe la actual.
 */
const useClauseWindow = () => {
    const { data: semana, weekNumber } = useCurrentWeek();
    const datos = semana?.data || semana;
    const apertura = datos?.openingWeekDate || null;
    const siguienteNumero = datos?.nextWeek ?? (weekNumber ? weekNumber + 1 : null);

    const { data: calendarioSiguiente } = useQuery({
        queryKey: ['matchday', siguienteNumero],
        queryFn: () => fantasyAPI.getMatchday(siguienteNumero),
        enabled: !!siguienteNumero,
        staleTime: 60 * 60 * 1000,
    });

    const ahora = Date.now();
    const ventana = calcularVentanaClausulas(apertura, primerPartido(calendarioSiguiente), ahora);

    return {
        ...ventana,
        weekNumber,
        texto: describirLimite(ventana.limite, ahora),
    };
};

export default useClauseWindow;

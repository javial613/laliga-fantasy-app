import { useEffect, useState } from 'react';
import { formatearRestante, intervaloDeRefresco } from '../utils/cuentaAtras';

/**
 * Cuenta atrás viva hasta una fecha.
 *
 * El ritmo de repintado se ajusta a lo que queda: al segundo en la última
 * hora, y mucho más espaciado cuando faltan días. Así una lista larga de
 * tarjetas no repinta sesenta veces por minuto sin necesidad.
 */
const useCountdown = (fechaFin) => {
    const objetivo = fechaFin ? new Date(fechaFin).getTime() : null;
    const [ahora, setAhora] = useState(() => Date.now());

    useEffect(() => {
        if (objetivo == null || Number.isNaN(objetivo)) return undefined;
        const restante = objetivo - Date.now();
        const intervalo = intervaloDeRefresco(restante);
        if (!intervalo) return undefined;
        const id = setInterval(() => setAhora(Date.now()), intervalo);
        return () => clearInterval(id);
        // `ahora` entra a propósito: al cruzar un umbral (p. ej. bajar de una
        // hora) hay que reprogramar el intervalo al ritmo más fino.
    }, [objetivo, ahora]);

    if (objetivo == null || Number.isNaN(objetivo)) {
        return { texto: null, restante: null, expirado: false };
    }
    const restante = objetivo - ahora;
    return { texto: formatearRestante(restante), restante, expirado: restante <= 0 };
};

export default useCountdown;

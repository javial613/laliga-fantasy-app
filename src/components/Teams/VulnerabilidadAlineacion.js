import React from 'react';
import { ShieldAlert, ShieldCheck, Users, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

/** "A", "A y B", "A, B y C": con tres o más, la coma evita el trabalenguas. */
export const enumerar = (nombres) => {
    if (nombres.length <= 1) return nombres[0] || '';
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
};

/** Reparto de la plantilla, en el orden en que se nombran las formaciones. */
export const Composicion = ({ analisis }) => {
    if (!analisis) return <span className="text-gray-400">—</span>;
    const { porPosicion: p, total } = analisis;
    return (
        <span className="truncate">
            {total}
            <span className="text-gray-400 dark:text-gray-500">
                {' '}({p.porteros}·{p.defensas}·{p.medios}·{p.delanteros})
            </span>
        </span>
    );
};

/**
 * Aviso de que a este equipo se le puede dejar sin alinear pagando cláusulas.
 *
 * Un manager que no completa alineación no puntúa esa jornada, así que esto
 * vale tanto para atacar como para saber que te lo pueden hacer a ti.
 */
export const AvisoVulnerabilidad = ({ analisis, esMio }) => {
    if (!analisis) return null;

    if (!analisis.puedeAlinear) {
        return (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                    {esMio ? 'No puedes' : 'No puede'} formar alineación con esta plantilla.
                    {esMio ? ' No puntuarás' : ' No puntuará'} hasta {esMio ? 'que fiches' : 'que fiche'}.
                </span>
            </div>
        );
    }

    if (!analisis.vulnerable) return null;

    const { jugadores, coste } = analisis.jugada;
    const nombres = enumerar(jugadores.map((j) => j.nombre));
    const cuantas = jugadores.length === 1
        ? 'una cláusula'
        : `${jugadores.length} cláusulas a la vez`;

    return (
        <div className={`mt-2 flex items-start gap-2 rounded-lg border p-2 text-xs ${
            esMio
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
        }`}>
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
                {esMio ? (
                    <>
                        <strong>Te pueden dejar sin puntuar.</strong> Con {cuantas}:{' '}
                        <strong>{nombres}</strong> ({formatCurrency(coste)}). Si no fichas antes de
                        la jornada, no podrás formar alineación.
                    </>
                ) : (
                    <>
                        <strong>Se le puede dejar sin puntuar.</strong> Con {cuantas}:{' '}
                        <strong>{nombres}</strong>, por {formatCurrency(coste)} en total. No podrá
                        formar alineación salvo que fiche antes de la jornada.
                    </>
                )}
            </span>
        </div>
    );
};

/** Resumen de toda la liga, para no tener que repasar equipo por equipo. */
export const ResumenVulnerabilidad = ({ analisisPorEquipo, nombrePorEquipo, miTeamId, isLoading, ventana }) => {
    if (isLoading || !analisisPorEquipo || analisisPorEquipo.size === 0) return null;

    // El plazo condiciona todo lo de abajo, así que se enuncia aparte.
    const plazo = ventana?.texto ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {ventana.cerradaLaEnCurso
                ? `Ya no se puede clausular para esta jornada. Próximo plazo ${ventana.texto}.`
                : `Se puede clausular ${ventana.texto}. Cuentan los que se desbloqueen antes de esa hora.`}
        </p>
    ) : null;

    const vulnerables = [];
    let yoVulnerable = null;
    for (const [teamId, analisis] of analisisPorEquipo) {
        if (!analisis?.vulnerable) continue;
        if (miTeamId && String(teamId) === String(miTeamId)) yoVulnerable = analisis;
        else vulnerables.push({ teamId, analisis });
    }

    if (!yoVulnerable && vulnerables.length === 0) {
        return (
            <div className="card border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" aria-hidden="true" />
                <div className="text-sm text-green-800 dark:text-green-300">
                    <strong>Nadie puede dejar a nadie sin alinear.</strong> Ninguna plantilla de la
                    liga, ni la tuya, se queda sin formación posible con las cláusulas que se
                    pueden pagar dentro de plazo.
                    {plazo}
                </div>
            </div>
        );
    }

    vulnerables.sort((a, b) => a.analisis.jugada.coste - b.analisis.jugada.coste);

    return (
        <div className="card border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                    Alineaciones que se pueden romper
                </h3>
            </div>

            {yoVulnerable && (
                <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                    <strong>Cuidado: a ti también.</strong> Te bastan{' '}
                    {yoVulnerable.jugada.jugadores.length} cláusula
                    {yoVulnerable.jugada.jugadores.length === 1 ? '' : 's'} para quedarte sin
                    alineación ({enumerar(yoVulnerable.jugada.jugadores.map((j) => j.nombre))}),
                    por {formatCurrency(yoVulnerable.jugada.coste)}.
                </p>
            )}

            {vulnerables.length > 0 ? (
                <ul className="text-sm text-amber-900 dark:text-amber-300 space-y-1">
                    {vulnerables.map(({ teamId, analisis }) => (
                        <li key={teamId}>
                            <strong>{nombrePorEquipo?.get?.(String(teamId)) || `Equipo ${teamId}`}</strong>:{' '}
                            {enumerar(analisis.jugada.jugadores.map((j) => j.nombre))} ·{' '}
                            {formatCurrency(analisis.jugada.coste)}
                            {analisis.jugada.jugadores.length > 1
                                && ` (${analisis.jugada.jugadores.length} cláusulas)`}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-amber-900 dark:text-amber-300">
                    A ningún rival se le puede hacer dentro de plazo.
                </p>
            )}
            {plazo}
        </div>
    );
};

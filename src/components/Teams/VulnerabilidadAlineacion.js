import React from 'react';
import { ShieldAlert, ShieldCheck, Users, Clock, Hourglass, Wrench } from 'lucide-react';
import { formatCurrency, formatCurrencyWithSign } from '../../utils/helpers';
import { compararConValor, totalesDeJugada, NOMBRE_POSICION } from '../../utils/alineacionPosible';

/** "A", "A y B", "A, B y C": con tres o más, la coma evita el trabalenguas. */
export const enumerar = (nombres) => {
    if (nombres.length <= 1) return nombres[0] || '';
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
};

/**
 * Cláusula frente a valor de mercado, jugador a jugador.
 *
 * Sin esto el aviso dice cuánto cuesta la jugada pero no si sale a cuenta:
 * pagar 60 millones por alguien que vale 55 es muy distinto a pagarlos por
 * alguien que vale 62, aunque la cifra que se desembolsa sea la misma.
 */
export const DesgloseJugada = ({ jugadores }) => {
    const totales = totalesDeJugada(jugadores);

    return (
        <table className="mt-2 w-full text-[11px] leading-tight">
            <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="font-normal pr-3 py-0.5">Jugador</th>
                    <th className="font-normal pr-3 py-0.5">Valor</th>
                    <th className="font-normal pr-3 py-0.5">Cláusula</th>
                    <th className="font-normal py-0.5">Sobreprecio</th>
                </tr>
            </thead>
            <tbody>
                {jugadores.map((j) => {
                    const { diferencia, porcentaje } = compararConValor(j);
                    return (
                        <tr key={j.playerId || j.nombre} className="align-top">
                            <td className="pr-3 py-0.5 font-medium">{j.nombre}</td>
                            <td className="pr-3 py-0.5 whitespace-nowrap">
                                {j.valor != null ? formatCurrency(j.valor) : '—'}
                            </td>
                            <td className="pr-3 py-0.5 whitespace-nowrap">{formatCurrency(j.clausula)}</td>
                            <td className={`py-0.5 whitespace-nowrap ${
                                diferencia == null ? ''
                                    : diferencia > 0 ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-700 dark:text-green-400'
                            }`}>
                                {diferencia == null ? '—' : (
                                    <>
                                        {formatCurrencyWithSign(diferencia)}
                                        {porcentaje != null && (
                                            <span className="opacity-70">
                                                {' '}({porcentaje > 0 ? '+' : ''}{porcentaje}%)
                                            </span>
                                        )}
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
                {jugadores.length > 1 && (
                    <tr className="font-semibold border-t border-current/20">
                        <td className="pr-3 py-0.5">Total</td>
                        <td className="pr-3 py-0.5 whitespace-nowrap">
                            {totales.valor != null ? formatCurrency(totales.valor) : '—'}
                        </td>
                        <td className="pr-3 py-0.5 whitespace-nowrap">{formatCurrency(totales.clausula)}</td>
                        <td className="py-0.5 whitespace-nowrap">
                            {totales.diferencia != null ? formatCurrencyWithSign(totales.diferencia) : '—'}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
};

/**
 * Qué fichar para cerrar el agujero. Solo aparece en el equipo propio: saber
 * que te pueden dejar sin puntuar no sirve de nada sin saber qué hacer.
 */
export const Consejos = ({ consejos, pendientes = [] }) => {
    if (!consejos || consejos.length === 0) return null;

    const comoTexto = ({ clave, cuantos }) => {
        const nombre = NOMBRE_POSICION[clave];
        if (!nombre) return null;
        return cuantos === 1 ? `un ${nombre.singular}` : `${cuantos} ${nombre.plural}`;
    };

    const opciones = consejos.map(comoTexto).filter(Boolean);
    if (opciones.length === 0) return null;

    return (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Wrench className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
                <strong>Cómo cerrarlo:</strong> ficha{' '}
                {opciones.length === 1 ? opciones[0] : <>{enumerar(opciones.map((o) => o))} (con cualquiera vale)</>}
                . Un jugador recién fichado llega protegido, así que tapa el hueco de inmediato.
                {pendientes.length > 0 && (
                    <> También puedes blindar a <strong>{enumerar(pendientes.map((j) => j.nombre))}</strong>,
                    pero eso solo lo aplaza 24 horas.</>
                )}
            </span>
        </div>
    );
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
                    {esMio && <Consejos consejos={analisis.consejos} />}
                </span>
            </div>
        );
    }

    // Amenaza futura: hoy no se puede, pero se podrá al vencer una protección
    // antes del cierre. Va aparte y en otro tono, porque decir "te pueden
    // clausular" de alguien con la cláusula cerrada sería falso.
    if (!analisis.vulnerable) {
        if (!analisis.jugadaProxima) return null;
        const { jugadores, coste, desde, pendientes = [] } = analisis.jugadaProxima;
        const cuando = desde
            ? new Date(desde).toLocaleString('es-ES', {
                timeZone: 'Europe/Madrid',
                weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })
            : null;
        // Se nombra solo a quien sigue protegido: en una jugada de tres donde
        // dos ya están abiertos, decir que las tres están cerradas es falso.
        const faltan = pendientes.length ? pendientes : jugadores;
        const hayAbiertos = pendientes.length > 0 && pendientes.length < jugadores.length;
        return (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 p-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                <Hourglass className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                    <strong>Ojo, todavía no.</strong>{' '}
                    {cuando ? <>El <strong>{cuando}</strong> se abre</> : <>Cuando se abra</>}{' '}
                    la cláusula de <strong>{enumerar(faltan.map((j) => j.nombre))}</strong>
                    {hayAbiertos && <> —las demás ya están abiertas—</>}, y a partir de ahí{' '}
                    {esMio ? 'te' : 'le'} pueden dejar sin puntuar clausulando a{' '}
                    <strong>{enumerar(jugadores.map((j) => j.nombre))}</strong>
                    {' '}por {formatCurrency(coste)}.
                    <DesgloseJugada jugadores={jugadores} />
                    {esMio && <Consejos consejos={analisis.consejos} pendientes={pendientes} />}
                </span>
            </div>
        );
    }

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
                        <strong>Te pueden dejar sin puntuar ya mismo.</strong> Con {cuantas}:{' '}
                        <strong>{nombres}</strong> ({formatCurrency(coste)}). Si no fichas antes de
                        la jornada, no podrás formar alineación.
                    </>
                ) : (
                    <>
                        <strong>Se le puede dejar sin puntuar ya mismo.</strong> Con {cuantas}:{' '}
                        <strong>{nombres}</strong>, por {formatCurrency(coste)} en total. No podrá
                        formar alineación salvo que fiche antes de la jornada.
                    </>
                )}
                <DesgloseJugada jugadores={jugadores} />
                {esMio && <Consejos consejos={analisis.consejos} />}
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
    let proximos = 0;
    for (const [teamId, analisis] of analisisPorEquipo) {
        if (analisis?.jugadaProxima) proximos += 1;
        if (!analisis?.vulnerable) continue;
        if (miTeamId && String(teamId) === String(miTeamId)) yoVulnerable = analisis;
        else vulnerables.push({ teamId, analisis });
    }

    if (!yoVulnerable && vulnerables.length === 0) {
        return (
            <div className="card border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" aria-hidden="true" />
                <div className="text-sm text-green-800 dark:text-green-300">
                    <strong>Nadie puede dejar a nadie sin alinear ahora mismo.</strong> Ninguna
                    plantilla de la liga, ni la tuya, se queda sin formación posible con las
                    cláusulas que están abiertas.
                    {proximos > 0 && (
                        <> Hay {proximos} equipo{proximos === 1 ? '' : 's'} que sí quedarían
                        expuestos al abrirse alguna cláusula: mira el aviso de su ficha.</>
                    )}
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

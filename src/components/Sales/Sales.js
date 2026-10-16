import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShoppingCart, XCircle, Loader2, Tag } from 'lucide-react';
import { fantasyAPI } from '../../services/api';
import useMyTeamId from '../../hooks/useMyTeamId';
import LoadingSpinner from '../Common/LoadingSpinner';
import { formatCurrency, getPositionName, isSuccessResponse, extractArray } from '../../utils/helpers';
import { invalidateAfterMarketListing } from '../../utils/cacheInvalidation';
import {
    cruzarPlantillaConMercado, precioDeVenta, repartirAcciones, ejecutarEnSerie,
} from '../../utils/ventaMasiva';

/**
 * Venta: poner y quitar jugadores del mercado en bloque.
 *
 * Existe para no tener que repetir el mismo gesto jugador por jugador. Las
 * operaciones salen de una en una (ver ejecutarEnSerie) y un fallo suelto no
 * detiene al resto.
 */
const Sales = () => {
    const queryClient = useQueryClient();
    const { teamId, leagueId, isLoading: cargandoEquipo } = useMyTeamId();

    const [seleccion, setSeleccion] = useState(new Set());
    const [progreso, setProgreso] = useState(null);

    const { data: teamData, isLoading: cargandoPlantilla, refetch } = useQuery({
        queryKey: ['teamData', leagueId, teamId],
        queryFn: () => fantasyAPI.getTeamData(leagueId, teamId),
        enabled: !!leagueId && !!teamId,
        staleTime: 2 * 60 * 1000,
    });

    const { data: marketData, refetch: refetchMercado } = useQuery({
        queryKey: ['market', leagueId],
        queryFn: () => fantasyAPI.getMarket(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 1000,
    });

    const jugadores = useMemo(() => {
        const payload = teamData?.data || teamData;
        return cruzarPlantillaConMercado(payload?.players, extractArray(marketData));
    }, [teamData, marketData]);

    const enVenta = jugadores.filter((j) => j.enVenta);
    const fuera = jugadores.filter((j) => !j.enVenta);

    const alternar = (id) => setSeleccion((previa) => {
        const nueva = new Set(previa);
        if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
        return nueva;
    });

    const refrescar = useCallback(async () => {
        await invalidateAfterMarketListing(queryClient, leagueId, teamId);
        await Promise.all([refetch(), refetchMercado()]);
    }, [queryClient, leagueId, teamId, refetch, refetchMercado]);

    const poner = useCallback(async (lista) => {
        if (lista.length === 0) return null;
        return ejecutarEnSerie(
            lista,
            async (j) => {
                const precio = precioDeVenta(j.valor);
                if (!precio) throw new Error('sin valor de mercado');
                const respuesta = await fantasyAPI.sellPlayerToMarket(leagueId, j.playerTeamId, precio);
                if (!isSuccessResponse(respuesta)) throw new Error('la liga rechazó la venta');
            },
            (hechos, total, j) => setProgreso({ texto: `Poniendo ${j.nombre}…`, hechos, total }),
        );
    }, [leagueId]);

    const quitar = useCallback(async (lista) => {
        if (lista.length === 0) return null;
        return ejecutarEnSerie(
            lista,
            async (j) => {
                const respuesta = await fantasyAPI.withdrawPlayerFromMarket(leagueId, j.marketId);
                if (!isSuccessResponse(respuesta)) throw new Error('la liga rechazó la retirada');
            },
            (hechos, total, j) => setProgreso({ texto: `Quitando ${j.nombre}…`, hechos, total }),
        );
    }, [leagueId]);

    const resumir = (resultados) => {
        const totales = resultados.filter(Boolean);
        const exitos = totales.reduce((a, r) => a + r.exitos, 0);
        const fallos = totales.flatMap((r) => r.fallos);
        if (exitos > 0) toast.success(`${exitos} jugador${exitos === 1 ? '' : 'es'} actualizado${exitos === 1 ? '' : 's'}`);
        if (fallos.length > 0) {
            toast.error(`${fallos.length} no se pudo${fallos.length === 1 ? '' : 'ieron'}: ${fallos[0].error}`);
        }
    };

    const ejecutar = useCallback(async (accion) => {
        setProgreso({ texto: 'Preparando…', hechos: 0, total: 0 });
        try {
            const resultados = await accion();
            await refrescar();
            resumir(resultados);
            setSeleccion(new Set());
        } finally {
            setProgreso(null);
        }
    }, [refrescar]);

    const ponerTodos = () => ejecutar(async () => [await poner(fuera)]);
    const quitarTodos = () => ejecutar(async () => [await quitar(enVenta.filter((j) => j.marketId != null))]);

    const aplicarSeleccion = () => {
        const { aPoner, aQuitar, sinAnuncio } = repartirAcciones(jugadores, seleccion);
        if (sinAnuncio.length > 0) {
            toast.error(`${sinAnuncio.length} en venta sin anuncio localizable; recarga e inténtalo de nuevo`);
        }
        return ejecutar(async () => [await poner(aPoner), await quitar(aQuitar)]);
    };

    if (cargandoEquipo || cargandoPlantilla) return <LoadingSpinner fullScreen={true} />;

    if (!teamId) {
        return (
            <div className="max-w-5xl mx-auto card p-6">
                <p className="text-gray-500">No se ha podido identificar tu equipo en esta liga.</p>
            </div>
        );
    }

    const ocupado = progreso !== null;
    const { aPoner, aQuitar } = repartirAcciones(jugadores, seleccion);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Tag className="w-7 h-7 text-primary-500" aria-hidden="true" /> Venta
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {jugadores.length} jugadores · {enVenta.length} en el mercado · {fuera.length} fuera
                </p>
            </div>

            <div className="card p-4 sm:p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Los jugadores se anuncian por su valor de mercado del momento.
                </p>

                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={ponerTodos} disabled={ocupado || fuera.length === 0}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50">
                        <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                        Poner todos en venta ({fuera.length})
                    </button>
                    <button type="button" onClick={quitarTodos} disabled={ocupado || enVenta.length === 0}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-50">
                        <XCircle className="w-4 h-4" aria-hidden="true" />
                        Quitar todos del mercado ({enVenta.length})
                    </button>
                </div>

                {progreso && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        {progreso.texto} {progreso.total > 0 && `(${progreso.hechos}/${progreso.total})`}
                    </div>
                )}
            </div>

            <div className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-200 dark:border-dark-border">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                        {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSeleccion(new Set(jugadores.map((j) => j.playerMasterId)))}
                            className="btn-secondary text-sm py-1.5">Seleccionar todos</button>
                        <button type="button" onClick={() => setSeleccion(new Set())} disabled={seleccion.size === 0}
                            className="btn-secondary text-sm py-1.5 disabled:opacity-50">Ninguno</button>
                        <button type="button" onClick={aplicarSeleccion}
                            disabled={ocupado || seleccion.size === 0}
                            className="btn-primary text-sm py-1.5 disabled:opacity-50">
                            Aplicar a los seleccionados
                            {(aPoner.length > 0 || aQuitar.length > 0) &&
                                ` (${aPoner.length} poner, ${aQuitar.length} quitar)`}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-border">
                                <th className="py-2 px-4 w-10"> </th>
                                <th className="py-2 pr-4">Jugador</th>
                                <th className="py-2 pr-4">Posición</th>
                                <th className="py-2 pr-4">Valor</th>
                                <th className="py-2 pr-4">Estado</th>
                                <th className="py-2 pr-4">Precio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jugadores.map((j) => {
                                const elegido = seleccion.has(j.playerMasterId);
                                return (
                                    <tr
                                        key={j.playerMasterId || j.playerTeamId}
                                        onClick={() => alternar(j.playerMasterId)}
                                        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td className="py-2 px-4">
                                            <input
                                                type="checkbox"
                                                checked={elegido}
                                                onChange={() => alternar(j.playerMasterId)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label={`Seleccionar ${j.nombre}`}
                                                className="w-4 h-4"
                                            />
                                        </td>
                                        <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                                            <span className="flex items-center gap-2">
                                                {j.escudo && <img src={j.escudo} alt="" className="w-4 h-4 object-contain" />}
                                                {j.nombre}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                            {j.posicionId != null ? getPositionName(j.posicionId) : '—'}
                                        </td>
                                        <td className="py-2 pr-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                            {formatCurrency(j.valor)}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {j.enVenta
                                                ? <span className="badge bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">En venta</span>
                                                : <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Fuera</span>}
                                        </td>
                                        <td className="py-2 pr-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                            {j.enVenta
                                                ? formatCurrency(j.precioActual || 0)
                                                : <span className="text-gray-400">{formatCurrency(precioDeVenta(j.valor))}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {jugadores.length === 0 && (
                    <p className="p-6 text-gray-500">No hay jugadores en tu plantilla.</p>
                )}
            </div>
        </div>
    );
};

export default Sales;

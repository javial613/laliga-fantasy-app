import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from '../../utils/motionShim';
import { Users, Search, User, Trophy, ChevronRight, Target, RefreshCw, TrendingUp } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { fantasyAPI } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatCurrencyWithSign, formatNumber, setImageFallback, extractArray } from '../../utils/helpers';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorDisplay from '../Common/ErrorDisplay';
import useMarketTrends from '../../hooks/useMarketTrends';
import useTeamMarketIncreases from '../../hooks/useTeamMarketIncreases';
import useTeamBudgets from '../../hooks/useTeamBudgets';
import { getAjusteManual } from '../../utils/ajustesSaldo';
import ClauseIncreasesModal from './ClauseIncreasesModal';

const Teams = () => {
  const leagueId = useAuthStore((state) => state.leagueId);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  // Handle URL search parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(decodeURIComponent(searchParam));
    }
  }, [location.search]);

  const { data: standings, isLoading, error, refetch } = useQuery({
    queryKey: ['standings', leagueId],
    queryFn: () => fantasyAPI.getLeagueRanking(leagueId),
    enabled: !!leagueId,
    retry: false,
    staleTime: 1 * 60 * 1000, // 1 minuto - equipos pueden cambiar con transacciones
    gcTime: 5 * 60 * 1000, // 5 minutos en memoria
  });

  // Market trends via el hook compartido (una query key para toda la app)
  const { trendsReady: trendsInitialized } = useMarketTrends();

  // Team market value increases via the shared hook
  const teamMarketIncreases = useTeamMarketIncreases(standings, leagueId, trendsInitialized);

  // Saldo estimado de cada manager, reconstruido desde el histórico de la liga
  const userTeamId = React.useMemo(() => {
    const entry = extractArray(standings).find((team) => {
      const teamUserId = team.userId || team.team?.userId || team.team?.manager?.id;
      return teamUserId && user?.userId && teamUserId.toString() === user.userId.toString();
    });
    return entry?.id || entry?.team?.id;
  }, [standings, user]);

  const { balanceFor, ledger, selfCheck, costeClausulas, historialClausulas, origenClausulas, remoto, nombrePorEquipo, refreshBudgets, datosDe, managerIdByTeamId, valorPorEquipo,
    descartarDeteccion, restaurarDetecciones, nDescartadas } = useTeamBudgets(leagueId, standings, userTeamId);
  const [clausulasDe, setClausulasDe] = useState(null); // teamId cuyas subidas se están viendo

  const subidasDe = (teamId) =>
    (historialClausulas || []).filter((h) => String(h.teamId) === String(teamId));


  if (isLoading) return <LoadingSpinner fullScreen={true} />;

  if (error) {
    return <ErrorDisplay
      error={error}
      title="Error al cargar los equipos"
      onRetry={refetch}
      fullScreen={true}
    />;
  }

  // Handle different API response structures
  const teamsData = extractArray(standings);

  // Filter teams by search term
  const filteredTeams = teamsData.filter(item => {
    const teamName = item.name || item.team?.name || '';
    const managerName = item.manager || item.team?.manager?.managerName || '';
    const searchLower = searchTerm.toLowerCase();

    return teamName.toLowerCase().includes(searchLower) ||
           managerName.toLowerCase().includes(searchLower);
  });

  const getTeamName = (item) => {
    return item.name || item.team?.name || 'Equipo';
  };

  

  const getTeamPoints = (item) => {
    return item.points || item.team?.points || 0;
  };

  // El valor se calcula sumando los jugadores de la plantilla, que es lo que
  // coincide con la app oficial. `teamValue` de la clasificación se desvía
  // decenas de millones y además en distinto sentido según el equipo, así que
  // solo se usa como respaldo mientras las plantillas se están cargando.
  const getTeamValue = (item) => {
    const calculado = valorPorEquipo?.[String(getTeamId(item))];
    if (calculado > 0) return calculado;
    return item.teamValue || item.team?.teamValue || 0;
  };

  const getUserId = (item) => {
    return item.userId || item.team?.userId || item.team?.manager?.id;
  };

  const getUserName = (item) => {
    // Priority order for display names
    return item.manager ||
           item.team?.manager?.managerName ||
           item.managerName ||
           item.userName ||
           item.user?.name ||
           'Usuario';
  };

  const isCurrentUser = (item) => {
    const itemUserId = getUserId(item);
    return itemUserId && user?.userId && itemUserId.toString() === user.userId.toString();
  };

  const getTeamId = (item) => {
    return item.id || item.team?.id;
  };

  // formatCurrency aplica Math.abs, así que un saldo negativo se mostraría como
  // positivo: para dinero en contra hay que conservar el signo.
  const formatSaldo = (value) =>
    value < 0 ? formatCurrencyWithSign(value) : formatCurrency(value);

  // Saldo de un equipo: el propio es exacto (lo da la API), el resto estimado
  // desde el histórico. `exacto` decide si el importe lleva "≈" delante.
  // Todos los saldos, incluido el propio, salen del cálculo sobre el histórico.
  // El saldo real de la API no se usa aquí a propósito: mostrarlo en la fila
  // propia escondería justamente el error que interesa vigilar. Sigue visible
  // en el desglose, enfrentado al calculado.
  const getSaldo = (item) => ({ valor: balanceFor(getTeamId(item)), exacto: false });

  // Patrimonio: lo que vale la plantilla más el dinero en caja. Es la medida de
  // capacidad real de compra, porque un equipo caro con la caja en negativo no
  // puede fichar y uno modesto con caja llena sí.
  const getPatrimonio = (item) => {
    const { valor, exacto } = getSaldo(item);
    if (valor == null) return { valor: null, exacto };
    return { valor: getTeamValue(item) + valor, exacto };
  };

  const getTeamMarketIncrease = (item) => {
    const teamId = getTeamId(item);
    return teamMarketIncreases.get(teamId) || 0;
  };

  const formatMarketChange = (change) => {
    if (!change || change === 0) return '0€';
    const formattedValue = Math.abs(change).toLocaleString('es-ES');
    return change > 0 ? `+${formattedValue}€` : `-${formattedValue}€`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || user.username}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    setImageFallback(e.target.parentNode, {
                      tag: 'span',
                      className: 'text-white text-lg font-bold',
                      text: (user?.name || user?.username || 'U').charAt(0),
                    });
                  }}
                />
              ) : (
                <span className="text-white text-lg font-bold">
                  {(user?.name || user?.username || 'U').charAt(0)}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Equipos
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {filteredTeams.length} equipos en la liga
          </p>
        </div>
        <button
          onClick={async () => {
            await queryClient.invalidateQueries({ queryKey: ['standings', leagueId] });
            await queryClient.invalidateQueries({ queryKey: ['teamData'] });
            // El botón debe refrescar también saldos y patrimonio: son las
            // columnas que más cambian tras vender o fichar.
            await refreshBudgets();
            refetch();
          }}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar equipo o manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Fiabilidad del saldo estimado.

          El saldo de los rivales no lo expone la API: se reconstruye desde el
          histórico. Como el saldo propio sí se conoce, se compara con el
          calculado y se enseña la desviación. Es la única forma honesta de
          presentar la cifra: si el modelo falla en tu equipo, falla en todos. */}
      {(() => {
        if (!ledger) return null;
        const problemas = [];
        if (!ledger.historyComplete) {
          problemas.push('el histórico de la liga no se pudo leer entero');
        }
        if (ledger.ignoredTypes.size > 0) {
          problemas.push(`hay movimientos de un tipo no contemplado (${[...ledger.ignoredTypes.keys()].join(', ')})`);
        }
        // El desvío se juzga contra el volumen movido, no en absoluto: 2M sobre
        // 900M de traspasos es ruido, y 2M sobre 10M sería un modelo roto.
        const movido = ledger.trace
          ? [...ledger.trace.values()].reduce(
              (t, r) => t + Math.abs(r.sumaUser1) + Math.abs(r.sumaUser2), 0)
          : 0;
        const desvio = selfCheck ? Math.abs(selfCheck.diff) : 0;
        const desvioRelativo = movido > 0 ? desvio / movido : 0;
        const desvioPequeno = desvio > 1 && desvioRelativo < 0.01;

        if (selfCheck && desvio > 1 && !desvioPequeno) {
          problemas.push(
            `en tu equipo el cálculo se desvía ${formatCurrencyWithSign(selfCheck.diff)} ` +
            `respecto a tu saldo real (${formatSaldo(selfCheck.real)})`
          );
        }

        const fiable = problemas.length === 0;
        // Nota: un desvío en el equipo propio significa que hay dinero que la
        // liga ha movido sin publicarlo en Actividad (p. ej. una ganancia por
        // jornada aún no listada). Los rivales tendrán el suyo y no hay forma
        // de conocerlo, así que el texto lo advierte en vez de fingir precisión.
        return (
          <div className={`mb-4 p-3 rounded-lg text-sm border ${
            fiable
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}>
            {fiable ? (
              desvioPequeno ? (
                <>
                  <strong>Saldos fiables.</strong> El tuyo es el exacto que da la API. Los de
                  los rivales se calculan desde el presupuesto inicial aplicando el histórico:
                  en tu equipo ese cálculo queda a {formatCurrency(desvio)} del real
                  ({(desvioRelativo * 100).toFixed(2)}% de los {formatCurrency(movido)} movidos),
                  diferencia que corresponde a dinero movido sin publicar en Actividad
                  —una ganancia por jornada aún no listada, o subidas de cláusula anteriores
                  a que la app empezara a vigilarlas—. Espera un margen parecido en los rivales.
                </>
              ) : (
                <>
                  <strong>Saldos verificados.</strong> Se calculan desde el presupuesto inicial
                  aplicando el histórico de movimientos, y el resultado cuadra al céntimo con tu
                  saldo real, así que el resto también debería estar bien.
                </>
              )
            ) : (
              <>
                <strong>Saldos aproximados.</strong> Tómalos como orientación: {problemas.join('; ')}.
              </>
            )}

            {/* Desglose de los movimientos propios por tipo de evento. Es la
                herramienta de diagnóstico: comparando cada cubo contra el saldo
                real se ve qué parte del modelo falla, sin adivinar. */}
            {ledger.trace && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs underline">
                  Ver desglose de mis movimientos
                </summary>
                <p className="mt-2 mb-1 text-xs opacity-80">
                  El PDF con el histórico completo se descarga desde la sección Actividad.
                </p>
                <div className="mt-2 text-xs overflow-x-auto">
                  <div className="mb-1">
                    Presupuesto inicial {formatCurrency(ledger.startingBudget)}
                    {selfCheck ? (
                      <>
                        {' · '}calculado {formatSaldo(selfCheck.estimated)} ·
                        real {formatSaldo(selfCheck.real)} ·
                        <strong> desvío {formatCurrencyWithSign(selfCheck.diff)}</strong>
                      </>
                    ) : (
                      <> · la API no ha devuelto tu saldo real, no se puede contrastar</>
                    )}
                  </div>
                  <div className="mb-1">
                    Saldos y valores calculados con los datos de{' '}
                    <strong>{datosDe
                      ? new Date(datosDe).toLocaleString('es-ES', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}</strong>
                    {' '}(ambos de la misma consulta, no de fechas distintas)
                  </div>
                  <div className="mb-1">
                    {ledger.totalItems} eventos leídos · {ledger.applied} aplicados ·
                    {' '}{ledger.duplicates} duplicados descartados ·
                    {' '}histórico {ledger.historyComplete ? 'completo' : 'INCOMPLETO'}
                  </div>
                  {(() => {
                    // Las correcciones manuales se listan aparte: son una
                    // estimación metida a mano, no un dato, y debe notarse.
                    const conAjuste = extractArray(standings)
                      .map((t) => ({ nombre: nombrePorEquipo?.get?.(String(t.id || t.team?.id)) }))
                      .map((t) => ({ ...t, ajuste: getAjusteManual(t.nombre) }))
                      .filter((t) => t.ajuste);
                    if (conAjuste.length === 0) return null;
                    return (
                      <div className="mb-1">
                        Correcciones manuales aplicadas:{' '}
                        {conAjuste.map((t) => `${t.nombre} ${formatCurrencyWithSign(-t.ajuste.importe)} (${t.ajuste.motivo})`).join(' · ')}
                      </div>
                    );
                  })()}
                  {(() => {
                    const total = Object.values(costeClausulas || {}).reduce((a, b) => a + b, 0);
                    const hist = historialClausulas || [];
                    if (!total && hist.length === 0) {
                      return origenClausulas === 'vigilante' ? (
                        <div className="mb-1">
                          Vigilancia de cláusulas activa · sin subidas detectadas todavía
                          {remoto?.tomadaEn && ` · última comprobación ${new Date(remoto.tomadaEn)
                            .toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      ) : null;
                    }
                    return (
                      <div className="mb-2">
                        <div className="mb-1">
                          Subidas de cláusula detectadas: {formatCurrency(total)} en la liga ·{' '}
                          {origenClausulas === 'vigilante' ? (
                            <>vigilancia continua (última comprobación:{' '}
                            {remoto?.tomadaEn
                              ? new Date(remoto.tomadaEn).toLocaleString('es-ES', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '—'})</>
                          ) : (
                            <>solo mientras la app está abierta (el vigilante no responde)</>
                          )}
                        </div>
                        {hist.length > 0 && (
                          <table className="min-w-full text-left">
                            <thead>
                              <tr className="border-b border-current/20">
                                <th className="pr-3 py-1">Fecha</th>
                                <th className="pr-3 py-1">Manager</th>
                                <th className="pr-3 py-1">Jugador</th>
                                <th className="pr-3 py-1">Cláusula</th>
                                <th className="pr-3 py-1">Subida</th>
                                <th className="pr-3 py-1">Pagó</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hist.map((h, i) => (
                                <tr key={i} className="border-b border-current/10">
                                  <td className="pr-3 py-1">
                                    {h.fecha ? new Date(h.fecha).toLocaleString('es-ES', {
                                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                    }) : '—'}
                                  </td>
                                  <td className="pr-3 py-1">
                                    {h.managerName || nombrePorEquipo?.get?.(String(h.teamId)) || h.teamId}
                                  </td>
                                  <td className="pr-3 py-1">{h.playerName || h.playerId}</td>
                                  <td className="pr-3 py-1">
                                    {formatCurrency(h.clauseAnterior)} → {formatCurrency(h.clauseActual)}
                                  </td>
                                  <td className="pr-3 py-1">{formatCurrency(h.subida)}</td>
                                  <td className="pr-3 py-1 font-semibold">{formatCurrency(h.coste)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })()}
                  {(ledger.skipped.sinManager > 0 || ledger.skipped.sinImporte > 0
                    || ledger.skipped.tipoDesconocido > 0) && (
                    <div className="mb-1">
                      Descartados: {ledger.skipped.sinManager} sin manager reconocible ·
                      {' '}{ledger.skipped.sinImporte} sin importe ·
                      {' '}{ledger.skipped.tipoDesconocido} de tipo no contemplado
                    </div>
                  )}
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-current/20">
                        <th className="pr-3 py-1">Tipo</th>
                        <th className="pr-3 py-1">Como protagonista</th>
                        <th className="pr-3 py-1">Como contraparte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ledger.trace.entries()].map(([tipo, r]) => (
                        <tr key={tipo} className="border-b border-current/10">
                          <td className="pr-3 py-1">{tipo}</td>
                          <td className="pr-3 py-1">
                            {r.comoUser1} · {formatCurrencyWithSign(r.sumaUser1)}
                          </td>
                          <td className="pr-3 py-1">
                            {r.comoUser2} · {formatCurrencyWithSign(r.sumaUser2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        );
      })()}

      {/* Teams List */}
      <div className="card divide-y divide-gray-200 dark:divide-dark-border">
        {filteredTeams.map((item, index) => {
          const teamId = getTeamId(item);
          const isUser = isCurrentUser(item);
          const position = item.position || index + 1;

          return (
            <motion.div
              key={teamId || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                isUser ? 'bg-primary-50 dark:bg-primary-900/10 border-l-4 border-primary-500' : ''
              }`}
            >
              {/* flex-wrap: con cinco métricas los tres bloques no caben en pantallas
                  de ~1000px de contenido (la barra lateral se lleva ~370px del
                  ancho, pero el breakpoint xl mira la ventana completa). Sin
                  envolver, el único bloque que puede encoger es el del nombre y
                  desaparecía por completo. */}
              <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-center xl:justify-between gap-4 overflow-hidden">
                {/* Team Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0 xl:min-w-[260px] overflow-hidden">
                  {/* Position */}
                  <div className="flex items-center gap-1 min-w-[60px] xl:min-w-[80px] flex-shrink-0">
                    {position <= 3 && (
                      <Trophy className="w-4 h-4 xl:w-5 xl:h-5 text-yellow-500" />
                    )}
                    <span className={`text-base xl:text-lg font-bold px-2 xl:px-3 py-1 rounded-full ${
                      position <= 3
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      #{position}
                    </span>
                  </div>

                  {/* Manager Avatar & Info */}
                  <div className="flex items-center gap-2 xl:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 xl:w-12 xl:h-12 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-base xl:text-lg font-bold">
                        {getUserName(item).charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base xl:text-xl font-semibold text-gray-900 dark:text-white truncate">
                          {getUserName(item)}
                        </h3>
                        {isUser && (
                          <span className="badge bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400 flex-shrink-0">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                        <User className="w-3 h-3 xl:w-4 xl:h-4 flex-shrink-0" />
                        <span className="truncate">{getTeamName(item)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats - Responsive Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex xl:items-center gap-4 xl:gap-6 min-w-0 text-center xl:text-left overflow-hidden">
                  <div className="min-w-0">
                    <p className="text-xs xl:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                      Puntos
                    </p>
                    <p className="text-lg xl:text-2xl font-bold text-gray-900 dark:text-white truncate">
                      {formatNumber(getTeamPoints(item))}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs xl:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                      Valor
                    </p>
                    <p className="text-sm xl:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {formatCurrency(getTeamValue(item))}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs xl:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                      Saldo aprox.
                    </p>
                    {(() => {
                      const { valor, exacto } = getSaldo(item);
                      return (
                        <p className={`text-sm xl:text-lg font-semibold truncate ${
                          valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {valor != null ? `${exacto ? '' : '≈ '}${formatSaldo(valor)}` : '—'}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs xl:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                      Patrimonio
                    </p>
                    {(() => {
                      const { valor, exacto } = getPatrimonio(item);
                      return (
                        <p className={`text-sm xl:text-lg font-bold truncate ${
                          valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'
                        }`}>
                          {valor != null ? `${exacto ? '' : '≈ '}${formatSaldo(valor)}` : '—'}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs xl:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                      Subida 24h
                    </p>
                    <p className={`text-sm font-medium truncate ${
                      getTeamMarketIncrease(item) > 0
                        ? 'text-green-600 dark:text-green-400'
                        : getTeamMarketIncrease(item) < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {formatMarketChange(getTeamMarketIncrease(item))}
                    </p>
                  </div>
                </div>

                {/* Actions - Desktop */}
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setClausulasDe(teamId)}
                    className="btn-secondary flex items-center gap-2 relative"
                    title="Ver subidas de cláusula detectadas"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="hidden lg:inline">Cláusulas</span>
                    {costeClausulas?.[String(teamId)] > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </button>
                  <Link
                    to={`/teams/${teamId}/lineup`}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    <span className="hidden lg:inline">Alineación</span>
                  </Link>
                  <Link
                    to={`/teams/${teamId}/players`}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden lg:inline">Jugadores</span>
                  </Link>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Mobile Actions - Big Touch-Friendly Buttons */}
              <div className="md:hidden mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setClausulasDe(teamId)}
                  className="btn-secondary w-full flex items-center justify-center gap-2 py-3 text-base font-semibold mb-3"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Subidas de cláusula</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to={`/teams/${teamId}/lineup`}
                    className="btn-primary flex items-center justify-center gap-2 py-3 text-base font-semibold"
                  >
                    <Target className="w-5 h-5" />
                    <span>Alineación</span>
                  </Link>
                  <Link
                    to={`/teams/${teamId}/players`}
                    className="btn-secondary flex items-center justify-center gap-2 py-3 text-base font-semibold"
                  >
                    <Users className="w-5 h-5" />
                    <span>Jugadores</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredTeams.length === 0 && (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No se encontraron equipos
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Intenta ajustar tu búsqueda' : 'Los equipos se cargarán cuando estén disponibles'}
          </p>
        </div>
      )}


      <ClauseIncreasesModal
        isOpen={clausulasDe != null}
        onClose={() => setClausulasDe(null)}
        managerName={clausulasDe != null ? nombrePorEquipo?.get?.(String(clausulasDe)) : null}
        subidas={clausulasDe != null ? subidasDe(clausulasDe) : []}
        ajusteManual={clausulasDe != null
          ? getAjusteManual(nombrePorEquipo?.get?.(String(clausulasDe)))
          : null}
        ledger={ledger}
        managerId={clausulasDe != null ? managerIdByTeamId?.get?.(String(clausulasDe)) : null}
        presupuestoInicial={ledger?.startingBudget ?? 100000000}
        onDescartar={descartarDeteccion}
        onRestaurar={restaurarDetecciones}
        nDescartadas={nDescartadas}
      />
    </div>
  );
};

export default Teams;


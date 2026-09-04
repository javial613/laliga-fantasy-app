import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import Modal from '../Common/Modal';
import { formatCurrency, formatCurrencyWithSign } from '../../utils/helpers';

const fmtFecha = (valor) => {
    if (!valor) return '—';
    const d = new Date(valor);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * Subidas de cláusula detectadas a un manager, jugador a jugador.
 *
 * Estas operaciones no aparecen en el histórico de la liga, así que el saldo
 * las descuenta a partir de comparar instantáneas. Esta ventana existe para
 * poder auditar ese descuento: si una línea no cuadra con lo que hizo el
 * manager, el saldo estimado tampoco cuadrará.
 */
// Etiquetas del desglose. Ojo con el tipo 1: la API no separa las cláusulas
// pagadas de las compras a otro manager (la pantalla de Actividad las deduce
// por heurística), así que aquí van juntas y conviene que se note.
const TIPOS = {
    1: 'compras a otro manager y cláusulas pagadas',
    31: 'fichajes del mercado',
    32: 'cláusulas pagadas',
    33: 'ventas',
    6: 'ganancias por jornada',
};

/** Desglose de los movimientos de un manager a partir del registro del cálculo. */
const desglosarMovimientos = (ledger, managerId) => {
    if (!ledger?.audit || managerId == null) return null;
    const id = String(managerId);
    const porTipo = new Map();
    let neto = 0;
    for (const e of ledger.audit) {
        const delta = (e.user1 === id ? e.delta1 : 0) + (e.user2 === id ? e.delta2 : 0);
        if (!delta) continue;
        const fila = porTipo.get(e.tipo) || { n: 0, suma: 0 };
        fila.n += 1;
        fila.suma += delta;
        porTipo.set(e.tipo, fila);
        neto += delta;
    }
    return porTipo.size ? { porTipo: [...porTipo.entries()].sort((a, b) => a[1].suma - b[1].suma), neto } : null;
};

const ClauseIncreasesModal = ({
    isOpen, onClose, managerName, subidas = [], ajusteManual = null,
    ledger = null, managerId = null, presupuestoInicial = 100000000,
    onDescartar = null, nDescartadas = 0, onRestaurar = null,
}) => {
    const total = subidas.reduce((s, x) => s + (x.coste || 0), 0);
    const desglose = desglosarMovimientos(ledger, managerId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
            <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 flex-shrink-0" />
                            <span className="truncate">Subidas de cláusula · {managerName || 'Equipo'}</span>
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Subir una cláusula cuesta la mitad de lo que sube.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {subidas.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No se ha detectado ninguna subida de cláusula de este manager.
                        <div className="mt-2 text-xs">
                            Solo se detectan las que ocurren entre dos visitas tuyas a esta pantalla:
                            las anteriores no dejan rastro del que deducirlas.
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                            <strong>{subidas.length}</strong> subida{subidas.length !== 1 ? 's' : ''} detectada
                            {subidas.length !== 1 ? 's' : ''} · pagó <strong>{formatCurrency(total)}</strong> en total
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-border">
                                        <th className="py-2 pr-3">Fecha</th>
                                        <th className="py-2 pr-3">Jugador</th>
                                        <th className="py-2 pr-3">Cláusula</th>
                                        <th className="py-2 pr-3">Subió</th>
                                        <th className="py-2 pr-3">Pagó</th>
                                        <th className="py-2 w-8" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {subidas.map((s, i) => (
                                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                                            <td className="py-2 pr-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                {fmtFecha(s.fecha)}
                                            </td>
                                            <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                                                {s.playerName || s.playerId}
                                            </td>
                                            <td className="py-2 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                                {formatCurrency(s.clauseAnterior)} → {formatCurrency(s.clauseActual)}
                                            </td>
                                            <td className="py-2 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                                {formatCurrency(s.subida)}
                                            </td>
                                            <td className="py-2 pr-3 whitespace-nowrap font-semibold text-red-600 dark:text-red-400">
                                                −{formatCurrency(s.coste)}
                                            </td>
                                            <td className="py-2">
                                                {onDescartar && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDescartar(s)}
                                                        title="Descartar: dejará de contar en el saldo"
                                                        aria-label={`Descartar la subida de ${s.playerName || s.playerId}`}
                                                        className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {nDescartadas > 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {nDescartadas} detección{nDescartadas !== 1 ? 'es' : ''} descartada
                        {nDescartadas !== 1 ? 's' : ''} — no cuenta{nDescartadas !== 1 ? 'n' : ''} en el saldo.
                        {onRestaurar && (
                            <button
                                type="button"
                                onClick={onRestaurar}
                                className="ml-1 underline hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                Restaurar todas
                            </button>
                        )}
                    </p>
                )}

                {/* De dónde sale su saldo. Sin esto, la cifra de patrimonio de un
                    rival es un número que hay que creerse; con el desglose se
                    puede contrastar contra el histórico de la liga. */}
                {desglose && (
                    <div className="mt-5 pt-4 border-t border-gray-200 dark:border-dark-border">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                            Cómo sale su saldo
                        </h3>
                        <table className="min-w-full text-sm">
                            <tbody>
                                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                    <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">Presupuesto inicial</td>
                                    <td className="py-1.5 text-right">{formatCurrency(presupuestoInicial)}</td>
                                </tr>
                                {desglose.porTipo.map(([tipo, fila]) => (
                                    <tr key={tipo} className="border-b border-gray-100 dark:border-gray-700/50">
                                        <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">
                                            {TIPOS[tipo] || `tipo ${tipo}`}{' '}
                                            <span className="text-gray-400">({fila.n})</span>
                                        </td>
                                        <td className={`py-1.5 text-right ${fila.suma < 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'}`}>
                                            {formatCurrencyWithSign(fila.suma)}
                                        </td>
                                    </tr>
                                ))}
                                {total > 0 && (
                                    <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                        <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">subidas de cláusula</td>
                                        <td className="py-1.5 text-right text-red-600 dark:text-red-400">
                                            {formatCurrencyWithSign(-total)}
                                        </td>
                                    </tr>
                                )}
                                {ajusteManual && (
                                    <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                        <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">corrección manual</td>
                                        <td className={`py-1.5 text-right ${ajusteManual.importe > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'}`}>
                                            {formatCurrencyWithSign(-ajusteManual.importe)}
                                        </td>
                                    </tr>
                                )}
                                <tr className="font-bold">
                                    <td className="py-2 pr-3 text-gray-900 dark:text-white">Saldo</td>
                                    <td className="py-2 text-right text-gray-900 dark:text-white">
                                        {formatCurrencyWithSign(
                                            presupuestoInicial + desglose.neto - total - (ajusteManual?.importe || 0))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {ajusteManual && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                        <strong>Además, corrección manual de {formatCurrencyWithSign(-ajusteManual.importe)}.</strong>{' '}
                        Es una estimación introducida a mano ({ajusteManual.motivo}), no un dato detectado.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ClauseIncreasesModal;

import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import Modal from '../Common/Modal';
import { formatCurrency } from '../../utils/helpers';

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
const ClauseIncreasesModal = ({ isOpen, onClose, managerName, subidas = [], ajusteManual = null }) => {
    const total = subidas.reduce((s, x) => s + (x.coste || 0), 0);

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
                                        <th className="py-2">Pagó</th>
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
                                            <td className="py-2 whitespace-nowrap font-semibold text-red-600 dark:text-red-400">
                                                −{formatCurrency(s.coste)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {ajusteManual && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                        <strong>Además, corrección manual de −{formatCurrency(ajusteManual.importe)}.</strong>{' '}
                        Es una estimación introducida a mano ({ajusteManual.motivo}), no un dato detectado.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ClauseIncreasesModal;

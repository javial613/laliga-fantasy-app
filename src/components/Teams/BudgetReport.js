import React from 'react';
import { formatCurrencyWithSign, formatCurrency } from '../../utils/helpers';

/**
 * Informe imprimible de los movimientos de la liga y de cómo el cálculo de
 * saldos ha tratado cada uno.
 *
 * Se imprime con el diálogo del sistema (Guardar como PDF) en lugar de generar
 * el PDF con una librería: evita sumar una dependencia pesada al bundle y el
 * resultado es un PDF de texto real, no una imagen, así que se puede leer y
 * buscar dentro.
 *
 * Vive siempre en el DOM pero oculto; sólo la hoja de estilos de impresión lo
 * muestra, y oculta el resto de la aplicación.
 */
const fmtFecha = (valor) => {
    if (!valor) return '—';
    const d = new Date(valor);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TIPOS = {
    1: 'compró', 4: 'blindó', 6: 'ganancia jornada', 7: 'alineación incorrecta',
    9: 'nuevo miembro', 31: 'fichó', 32: 'clausuló', 33: 'vendió',
};

const BudgetReport = ({
    ledger, selfCheck, ownManagerId, ownName, leagueName,
    // Resolutores de la pantalla de Actividad: allí los nombres de manager y
    // jugador se resuelven con cachés y consultas bajo demanda, así que el
    // informe los reutiliza en vez de conformarse con los campos crudos.
    getUserName, getSellerName, getPlayerName,
}) => {
    if (!ledger?.audit) return null;

    // Orden cronológico ascendente: el saldo acumulado sólo tiene sentido leído
    // de principio a fin, y la API devuelve lo más reciente primero.
    const eventos = [...ledger.audit].sort((a, b) => {
        const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
        const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
        return ta - tb;
    });

    const nombreUser1 = (e) =>
        (getUserName && e.item ? getUserName(e.item) : null) || e.user1Name || e.user1 || '—';
    const nombreUser2 = (e) =>
        (getSellerName && e.item ? getSellerName(e.item) : null) || e.user2Name || e.user2 || '—';
    const nombreJugador = (e) =>
        (getPlayerName && e.item ? getPlayerName(e.item) : null) || e.playerName || e.playerId || '—';

    const propioId = ownManagerId == null ? null : String(ownManagerId);
    let saldo = ledger.startingBudget;
    const mios = [];
    for (const e of eventos) {
        const delta = (e.user1 === propioId ? e.delta1 : 0) + (e.user2 === propioId ? e.delta2 : 0);
        const meAfecta = e.user1 === propioId || e.user2 === propioId;
        if (!meAfecta) continue;
        saldo += delta;
        mios.push({ ...e, delta, saldo });
    }

    return (
        <div className="budget-report">
            <h1>Movimientos y cálculo de saldo</h1>
            <p>
                Liga: {leagueName || '—'} · Manager: {ownName || '—'} ·
                Generado: {fmtFecha(new Date().toISOString())}
            </p>

            <h2>Resumen</h2>
            <table>
                <tbody>
                    <tr><th>Presupuesto inicial</th><td>{formatCurrency(ledger.startingBudget)}</td></tr>
                    <tr><th>Saldo calculado</th><td>{formatCurrencyWithSign(saldo)}</td></tr>
                    <tr><th>Saldo real (API)</th><td>{selfCheck ? formatCurrencyWithSign(selfCheck.real) : 'no disponible'}</td></tr>
                    <tr><th>Desvío</th><td>{selfCheck ? formatCurrencyWithSign(saldo - selfCheck.real) : '—'}</td></tr>
                    <tr><th>Eventos leídos / aplicados</th><td>{ledger.totalItems} / {ledger.applied}</td></tr>
                    <tr><th>Duplicados descartados</th><td>{ledger.duplicates}</td></tr>
                    <tr><th>Descartados sin manager / sin importe / tipo no contemplado</th>
                        <td>{ledger.skipped.sinManager} / {ledger.skipped.sinImporte} / {ledger.skipped.tipoDesconocido}</td></tr>
                    <tr><th>Histórico</th><td>{ledger.historyComplete ? 'completo' : 'INCOMPLETO'}</td></tr>
                </tbody>
            </table>

            <h2>Mis movimientos ({mios.length}), en orden cronológico</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Fecha</th><th>Tipo</th><th>Jugador</th>
                        <th>Protagonista</th><th>Contraparte</th>
                        <th>Importe</th><th>Efecto</th><th>Saldo</th><th>Trato</th>
                    </tr>
                </thead>
                <tbody>
                    {mios.map((e, i) => (
                        <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{fmtFecha(e.fecha)}</td>
                            <td>{e.tipo} {TIPOS[e.tipo] ? `(${TIPOS[e.tipo]})` : '(?)'}</td>
                            <td>{nombreJugador(e)}</td>
                            <td>{nombreUser1(e)}</td>
                            <td>{nombreUser2(e)}</td>
                            <td>{formatCurrency(e.importe)}</td>
                            <td>{formatCurrencyWithSign(e.delta)}</td>
                            <td>{formatCurrencyWithSign(e.saldo)}</td>
                            <td>{e.disposicion}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h2>Todos los movimientos de la liga ({eventos.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Fecha</th><th>Tipo</th><th>Jugador</th>
                        <th>Protagonista</th><th>Contraparte</th>
                        <th>Importe</th><th>Δ prot.</th><th>Δ contra.</th><th>Trato</th>
                    </tr>
                </thead>
                <tbody>
                    {eventos.map((e, i) => (
                        <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{fmtFecha(e.fecha)}</td>
                            <td>{e.tipo} {TIPOS[e.tipo] ? `(${TIPOS[e.tipo]})` : '(?)'}</td>
                            <td>{nombreJugador(e)}</td>
                            <td>{nombreUser1(e)}</td>
                            <td>{nombreUser2(e)}</td>
                            <td>{formatCurrency(e.importe)}</td>
                            <td>{formatCurrencyWithSign(e.delta1)}</td>
                            <td>{formatCurrencyWithSign(e.delta2)}</td>
                            <td>{e.disposicion}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BudgetReport;

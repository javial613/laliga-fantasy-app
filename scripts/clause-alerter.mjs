/**
 * Aviso puntual: manda un mensaje justo cuando un jugador rival queda
 * clausulable.
 *
 * El cron de GitHub es irregular (huecos observados de 2 a 8 horas), así que
 * comprobar periódicamente si ya se abrió daría avisos con horas de retraso,
 * inservibles cuando lo que importa es llegar el primero.
 *
 * Como la hora exacta de apertura viene en el propio dato, aquí no se sondea:
 * el proceso **espera dormido hasta ese instante** y entonces envía. Los
 * repositorios públicos tienen minutos de Actions ilimitados, así que esperar
 * no cuesta nada; el único límite es el tiempo máximo de un trabajo.
 *
 * Lo que quede fuera de esa ventana lo recogerá una ejecución posterior, que
 * volverá a dormir hasta su hora.
 */
import fs from 'node:fs/promises';
import { seleccionarAvisos, limpiarAvisados } from '../src/utils/clauseAlerts.js';

const ESTADO = process.env.SALIDA || 'data/clause-watch.json';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const MI_EQUIPO = process.env.LALIGA_TEAM_ID || null;
// Margen por debajo del límite de un trabajo de GitHub (6 h), para que la
// espera nunca lo agote a mitad.
const ESPERA_MAX_MS = Number(process.env.ESPERA_MAX_MINUTOS || 300) * 60 * 1000;

const dinero = (n) => `${Math.round(n).toLocaleString('es-ES')}€`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const enviar = async (texto) => {
    if (!TG_TOKEN || !TG_CHAT) {
        console.log('Telegram no configurado; no se envía nada.');
        return false;
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT, text: texto, parse_mode: 'HTML' }),
        });
        if (!res.ok) {
            console.warn(`Telegram devolvió ${res.status}: ${(await res.text()).slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`Fallo al enviar: ${err.message}`);
        return false;
    }
};

const mensaje = (a) => {
    const lineas = [
        `🔓 <b>${a.nombre}</b> ya se puede clausular`,
        a.manager ? `Es de ${a.manager}` : null,
        '',
        `Cláusula: <b>${dinero(a.clausula)}</b>`,
        `Valor: ${dinero(a.valor)}`,
    ];
    if (a.gangaPor > 0) lineas.push('', `💰 Vale ${dinero(a.gangaPor)} más de lo que cuesta`);
    return lineas.filter((l) => l !== null).join('\n');
};

const main = async () => {
    const estado = JSON.parse(await fs.readFile(ESTADO, 'utf8'));
    const nombrePorEquipo = new Map(Object.entries(estado.managers || {}));

    const avisados = limpiarAvisados(estado.avisados, Date.now());
    const horas = ESPERA_MAX_MS / 3600000;
    const pendientes = seleccionarAvisos(estado.jugadores, {
        ahora: Date.now(),
        ventanaHoras: horas,
        yaAvisados: avisados,
        miEquipo: MI_EQUIPO,
        nombrePorEquipo,
    // Solo rivales: de los propios no hay nada que clausular.
    }).filter((a) => !a.esMio);

    if (pendientes.length === 0) {
        console.log(`Ninguna cláusula rival se abre en las próximas ${horas.toFixed(1)} h.`);
        return;
    }

    console.log(`${pendientes.length} apertura(s) dentro de la ventana:`);
    for (const a of pendientes) {
        console.log(`  ${a.nombre} (${a.manager || a.teamId}) a las ${new Date(a.apertura).toISOString()}`);
    }

    const finDeVentana = Date.now() + ESPERA_MAX_MS;
    for (const a of pendientes) {
        if (a.apertura > finDeVentana) break;          // lo cogerá otra ejecución
        const espera = a.apertura - Date.now();
        if (espera > 0) {
            console.log(`Esperando ${Math.round(espera / 60000)} min hasta ${a.nombre}…`);
            await dormir(espera);
        }
        const enviado = await enviar(mensaje(a));
        // Solo se marca si salió: si Telegram falla, otra ejecución lo reintenta.
        if (enviado) {
            avisados[a.clave] = a.apertura;
            console.log(`Avisado: ${a.nombre}`);
        }
    }

    estado.avisados = avisados;
    await fs.writeFile(ESTADO, `${JSON.stringify(estado, null, 2)}\n`, 'utf8');
};

main().catch((err) => {
    console.error(`ERROR: ${err.stack || err.message}`);
    process.exit(1);
});

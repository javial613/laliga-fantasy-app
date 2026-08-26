/**
 * Vigilante de subidas de cláusula, sin interfaz.
 *
 * Pensado para ejecutarse periódicamente en GitHub Actions. Resuelve el
 * problema que la app no puede resolver sola: las subidas de cláusula no se
 * publican en el histórico de la liga y solo se detectan comparando el valor de
 * las cláusulas entre dos momentos del MISMO día (la revalorización automática
 * de madrugada hace inatribuible cualquier intervalo que la cruce). Con la app
 * eso exige que el usuario la abra dos veces antes de medianoche; aquí basta
 * con que la tarea corra cada hora.
 *
 * Reutiliza `src/utils/clauseTracker.js` en vez de reimplementarlo: es el mismo
 * código que usa la app y el que cubren sus tests.
 *
 * Variables de entorno:
 *   LALIGA_REFRESH_TOKEN  (obligatoria) refresh token de la cuenta
 *   LALIGA_LEAGUE_ID      (obligatoria) id de la liga a vigilar
 *   LALIGA_CLIENT_ID      (opcional)    por defecto el cliente web de LaLiga
 *   SALIDA                (opcional)    fichero de estado, por defecto data/clause-watch.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    construirInstantanea,
    detectarSubidasDeClausula,
    acumularCostes,
} from '../src/utils/clauseTracker.js';

// LaLiga emite el token con un client_id u otro según cómo se inició sesión
// (email/contraseña y OAuth usan identificadores distintos), y el refresco falla
// si no coincide con el que lo emitió. Se prueban los conocidos en vez de
// obligar a averiguarlo: son identificadores públicos, no secretos.
const CLIENT_IDS = process.env.LALIGA_CLIENT_ID
    ? [process.env.LALIGA_CLIENT_ID]
    : [
        'af88bcff-1157-40a0-b579-030728aacf0b', // OAuth / email
        '6457fa17-1224-416a-b21a-ee6ce76e9bc0', // cliente web
    ];
const TOKEN_URL = 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token'
    + '?p=B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
const API = 'https://fantasy-api.llt-services.com/api/v1/competition/1';
const SALIDA = process.env.SALIDA || 'data/clause-watch.json';
const MAX_HISTORIAL = 500;

// Los tokens duran unos 90 días. Sin este aviso, el vigilante moriría un día
// sin previo aviso y los saldos se quedarían congelados sin que nadie lo note
// hasta semanas después.
const DIAS_DE_AVISO = 14;

const avisarSiCaduca = (segundosRestantes) => {
    if (!Number.isFinite(segundosRestantes)) return;
    const dias = segundosRestantes / 86400;
    if (dias > DIAS_DE_AVISO) {
        console.log(`El acceso caduca en ${Math.round(dias)} días.`);
        return;
    }
    // Se escribe en el canal de error para que destaque en el registro.
    console.error(
        `AVISO: el acceso caduca en ${Math.round(dias)} día(s). Hay que renovar el secreto `
        + 'LALIGA_REFRESH_TOKEN sacándolo otra vez de la app (ver scripts/README-clause-watcher.md), '
        + 'o el vigilante dejará de funcionar.'
    );
};

const fatal = (mensaje) => {
    console.error(`ERROR: ${mensaje}`);
    process.exit(1);
};

/** Canjea el refresh token por un access token. Devuelve ambos, porque el
 *  refresh puede rotar y entonces hay que guardar el nuevo o la próxima
 *  ejecución fallará. */
const renovarSesion = async (refreshToken) => {
    let ultimoError = '';
    for (const clientId of CLIENT_IDS) {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                // Mismas cabeceras y parámetros que usa la app: sin `scope` el
                // proveedor responde 200 pero sin access_token, y sin
                // User-Agent algunos endpoints se comportan distinto.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                scope: 'openid offline_access',
            }),
        });
        const cuerpo = await res.text();
        if (res.ok) {
            const datos = JSON.parse(cuerpo);
            // El refresh rotado se guarda ANTES de validar nada más: el
            // proveedor ya ha invalidado el anterior, así que abortar aquí sin
            // guardarlo dejaría el secreto obsoleto y la próxima ejecución
            // fallaría con invalid_grant sin motivo aparente.
            if (datos.refresh_token && datos.refresh_token !== refreshToken) {
                await fs.writeFile('.refresh-token-nuevo', datos.refresh_token, 'utf8');
                console.log('El refresh token ha rotado: se actualizará el secreto.');
            }
            // El B2C de LaLiga no emite access_token para el scope `openid`:
            // el bearer que acepta la API es el id_token. La propia app hace
            // esta misma sustitución (ver authService: access_token || id_token).
            const bearer = datos.access_token || datos.id_token;
            if (!bearer) {
                fatal('la renovación no devolvió ningún token utilizable. Claves recibidas: '
                    + Object.keys(datos).join(', '));
            }
            console.log(`Sesión renovada (client_id ${clientId.slice(0, 8)}…`
                + `, bearer: ${datos.access_token ? 'access_token' : 'id_token'}).`);
            avisarSiCaduca(datos.refresh_token_expires_in);
            return { accessToken: bearer, refreshToken: datos.refresh_token || refreshToken };
        }
        ultimoError = `HTTP ${res.status}: ${cuerpo.slice(0, 300)}`;
    }
    fatal(`no se pudo renovar la sesión con ninguno de los client_id conocidos.\n${ultimoError}\n`
        + 'Si pone invalid_grant, el refresh token ya no vale: hay que sacarlo de nuevo de la app.');
};

const pedir = async (accessToken, ruta) => {
    const res = await fetch(`${API}${ruta}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'x-lang': 'es', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}`);
    return res.json();
};

const comoLista = (x) => (Array.isArray(x) ? x : (Array.isArray(x?.data) ? x.data
    : (Array.isArray(x?.elements) ? x.elements : [])));

const leerEstado = async (ruta) => {
    try {
        return JSON.parse(await fs.readFile(ruta, 'utf8'));
    } catch {
        return null;  // primera ejecución
    }
};

const main = async () => {
    const refreshInicial = process.env.LALIGA_REFRESH_TOKEN;
    const leagueId = process.env.LALIGA_LEAGUE_ID;
    if (!refreshInicial) fatal('falta LALIGA_REFRESH_TOKEN');
    if (!leagueId) fatal('falta LALIGA_LEAGUE_ID');

    const { accessToken, refreshToken } = await renovarSesion(refreshInicial);

    const clasificacion = comoLista(await pedir(accessToken, `/leagues/${leagueId}/standing?x-lang=es`));
    const equipos = clasificacion
        .map((e) => e.id || e.team?.id)
        .filter((id) => id != null)
        .map(String);
    if (equipos.length === 0) fatal('la clasificación no devolvió equipos');

    const jugadoresPorEquipo = new Map();
    for (const teamId of equipos) {
        try {
            const datos = await pedir(accessToken, `/leagues/${leagueId}/teams/${teamId}?x-lang=es`);
            const payload = datos?.data || datos;
            jugadoresPorEquipo.set(teamId, payload?.players || []);
        } catch (err) {
            console.warn(`equipo ${teamId} omitido: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 300));  // no atropellar la API
    }

    const instantanea = construirInstantanea(jugadoresPorEquipo);
    const jugadoresVistos = Object.keys(instantanea).length;
    if (jugadoresVistos === 0) fatal('no se obtuvo ninguna cláusula');

    const ahora = new Date().toISOString();
    const estado = await leerEstado(SALIDA);

    let subidas = [];
    let atribuible = false;
    const primeraVez = !estado?.jugadores;
    if (estado?.jugadores) {
        const r = detectarSubidasDeClausula(estado.jugadores, instantanea, {
            desde: estado.tomadaEn,
            hasta: ahora,
        });
        atribuible = r.atribuible;
        subidas = r.subidas.map((s) => ({ ...s, fecha: ahora }));
    }

    const costes = subidas.length ? acumularCostes(estado?.costes, subidas) : (estado?.costes || {});
    const historial = [...subidas, ...(estado?.historial || [])].slice(0, MAX_HISTORIAL);

    await fs.mkdir(path.dirname(SALIDA), { recursive: true });
    await fs.writeFile(SALIDA, `${JSON.stringify({
        tomadaEn: ahora,
        leagueId,
        jugadores: instantanea,
        costes,
        historial,
    }, null, 2)}\n`, 'utf8');

    const estadoIntervalo = primeraVez
        ? 'primera foto, nada que comparar todavía'
        : (atribuible ? 'atribuible' : 'NO atribuible: el intervalo cruza la revalorización nocturna');
    console.log(`${jugadoresVistos} cláusulas · ${estadoIntervalo} · ${subidas.length} subida(s) nueva(s)`);
    for (const s of subidas) {
        console.log(`  ${s.playerName || s.playerId}: ${s.clauseAnterior} -> ${s.clauseActual} (pagó ${s.coste})`);
    }
};

main().catch((err) => fatal(err.stack || err.message));

// ---------------------------------------------------------------------------
// Punto de entrada del servidor en Vercel.
//
// En el Mac, este mismo servidor sirve la app y hace de proxy. En Vercel los
// ficheros estáticos los sirve su CDN y aquí solo llegan /api, /stats y
// /health (ver vercel.json), así que se desactiva el servido de estáticos.
//
// No hace falta `listen`: Vercel invoca la app de Express como función.
// ---------------------------------------------------------------------------

// Deben fijarse antes de cargar la configuración, que lee el entorno al
// importarse.
process.env.APP_SERVE_STATIC = 'false';
const { loadConfig } = require('./config');
const { buildApp } = require('./index');

const app = buildApp(loadConfig());

// Detrás del CDN de Vercel la IP real del visitante llega en X-Forwarded-For;
// sin esto el límite de peticiones contaría a todo el mundo como uno solo.
// Se confía en UN salto —el de Vercel— y no en toda la cadena: con `true`
// cualquiera podría falsear la cabecera y saltarse el límite.
app.set('trust proxy', 1);

module.exports = app;

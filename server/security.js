// Validación de origen para el middleware CORS del servidor unificado.
// Módulo puro (sin dependencias) para poder testearlo desde la suite de CRA.

const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed === '*' || allowed === origin) return true;
    if (allowed.endsWith('*')) {
      return origin.startsWith(allowed.slice(0, -1));
    }
    if (allowed === 'app://.' && origin.startsWith('app://')) return true;
    return false;
  });
};

/**
 * ¿La petición viene de la propia página que sirve este servidor?
 *
 * Los navegadores no mandan `Origin` al leer, pero sí en cada escritura, así
 * que una app servida desde el mismo sitio se veía rechazada por su propio
 * proxy en cuanto intentaba hacer algo: leer funcionaba y actuar no. Detrás
 * de un CDN el host público llega en x-forwarded-host.
 */
const isSameOrigin = (origin, headers = {}) => {
  if (!origin) return false;
  const reenviado = headers['x-forwarded-host'];
  const anfitrion = (Array.isArray(reenviado) ? reenviado[0] : reenviado) || headers.host;
  if (!anfitrion) return false;
  // Con varios saltos la cabecera puede traer una lista; vale el primero.
  const esperado = String(anfitrion).split(',')[0].trim().toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === esperado;
  } catch (error) {
    return false;
  }
};

module.exports = { isOriginAllowed, isSameOrigin };

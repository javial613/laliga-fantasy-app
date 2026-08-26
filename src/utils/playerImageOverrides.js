import aubameyang from '../assets/players/188567.png';
import brightEde from '../assets/players/18030.png';

/**
 * Fotos locales para jugadores que la API sirve sin imagen.
 *
 * Se aplica en `normalizePlayer`, así que la foto entra por el mismo camino que
 * las de la API (`images.transparent`) y todas las pantallas la pintan con el
 * mismo CSS, sin casos especiales.
 *
 * Cada entrada se puede localizar por id **o por nombre**. El id es lo más
 * fiable cuando se conoce, pero no siempre se sabe con certeza; el nombre
 * cubre ese caso y evita que la foto desaparezca en silencio si el id no era
 * el que creíamos.
 *
 * Tienen prioridad sobre lo que devuelva la API: estas entradas existen justo
 * porque allí no hay foto utilizable, y si la API empezara a servir una URL
 * rota seguiríamos viendo un hueco. Para volver a la foto oficial de un
 * jugador, basta con borrar su entrada.
 */
const OVERRIDES = [
    {
        image: aubameyang,
        ids: [188567],
        names: ['aubameyang', 'p. aubameyang', 'pierre-emerick aubameyang', 'pierre emerick aubameyang'],
    },
    {
        image: brightEde,
        ids: [18030],
        names: ['bright ede', 'b. ede', 'ede', 'bright'],
    },
];

/** Minúsculas, sin acentos ni puntuación: 'P. Aubameyang' -> 'p aubameyang'. */
const normalize = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const BY_ID = new Map();
const BY_NAME = new Map();
for (const entry of OVERRIDES) {
    for (const id of entry.ids || []) BY_ID.set(String(id), entry.image);
    for (const name of entry.names || []) BY_NAME.set(normalize(name), entry.image);
}

/**
 * @param {Object|number|string} player Objeto jugador, o directamente su id.
 */
export const getPlayerImageOverride = (player) => {
    if (player == null) return null;

    if (typeof player !== 'object') return BY_ID.get(String(player)) || null;

    if (player.id != null) {
        const byId = BY_ID.get(String(player.id));
        if (byId) return byId;
    }

    for (const candidate of [player.nickname, player.name]) {
        const normalized = normalize(candidate);
        if (!normalized) continue;
        const byName = BY_NAME.get(normalized);
        if (byName) return byName;
        // El apodo puede traer el nombre de pila delante ("Pierre-Emerick
        // Aubameyang"): basta con que contenga el apellido registrado.
        for (const [key, image] of BY_NAME) {
            if (key.includes(' ')) continue; // solo apellidos sueltos
            if (normalized === key || normalized.endsWith(` ${key}`)) return image;
        }
    }

    return null;
};

export default OVERRIDES;

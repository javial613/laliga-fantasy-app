import { LALIGA_TEAMS } from '../services/onceParser';

/**
 * Índice de probabilidad de titularidad por jugador.
 *
 * Los datos salen del scraping de onces probables. Ese servicio, cuando el
 * scraping falla, rellena la alineación con la plantilla de la API y **asigna
 * probabilidades inventadas** (75% a los titulares, 25% al banquillo) para
 * poder pintar algo en su pantalla. Aquí eso no vale: una probabilidad falsa
 * con pinta de dato real es peor que no enseñar nada, porque se usa para
 * decidir fichajes. Por eso solo se acepta lo que viene de scraping de verdad.
 */

// Orígenes que NO son scraping: relleno de plantilla o complemento inventado.
const ORIGENES_NO_FIABLES = new Set(['laliga-api', 'laliga-api-supplement']);

/** teamId (el de LaLiga) -> slug de futbolfantasy. */
export const slugPorTeamId = (() => {
    const map = new Map();
    for (const [slug, info] of Object.entries(LALIGA_TEAMS)) {
        if (info.logoId) map.set(String(info.logoId), slug);
    }
    return map;
})();

/** Slugs necesarios para cubrir un conjunto de equipos, sin repetir. */
export const slugsParaEquipos = (teamIds) => {
    const slugs = new Set();
    for (const id of teamIds || []) {
        const slug = slugPorTeamId.get(String(id));
        if (slug) slugs.add(slug);
    }
    return [...slugs];
};

/**
 * @param {Array} alineaciones lo que devuelve preloadTeamLineups
 * @returns {Map<string, {probability:number|null, isStarter:boolean}>}
 */
export const construirIndiceTitularidad = (alineaciones) => {
    const index = new Map();

    for (const lineup of alineaciones || []) {
        // A nivel de alineación: solo scraping real.
        if (!lineup || typeof lineup.source !== 'string') continue;
        if (!lineup.source.startsWith('scraping')) continue;

        const todos = [
            ...(lineup.players?.starting || []),
            ...(lineup.players?.bench || []),
        ];

        for (const p of todos) {
            if (!p || p.id == null) continue;
            if (ORIGENES_NO_FIABLES.has(p.source)) continue;
            if (typeof p.isStarter !== 'boolean') continue;

            // probability 0 significa "el scraping no publicó porcentaje", no
            // "0% de opciones": se guarda como desconocido.
            const prob = Number(p.probability);
            index.set(String(p.id), {
                probability: Number.isFinite(prob) && prob > 0 ? prob : null,
                isStarter: p.isStarter,
            });
        }
    }

    return index;
};

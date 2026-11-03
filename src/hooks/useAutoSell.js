import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fantasyAPI } from '../services/api';
import { isSuccessResponse, extractArray } from '../utils/helpers';
import { invalidateAfterMarketListing } from '../utils/cacheInvalidation';
import { cruzarPlantillaConMercado, precioDeVenta } from '../utils/ventaMasiva';
import { detectarFichajes, idsDePlantilla, aPonerEnVenta, MAX_POR_TANDA } from '../utils/autoVenta';
import { useAutoSellStore } from '../stores/autoSellStore';

const CLAVE_FOTO = (leagueId, teamId) => `laliga_autoventa_plantilla_${leagueId}_${teamId}`;
const CADA = 30000;

const leer = (clave, pordefecto) => {
    try {
        const crudo = localStorage.getItem(clave);
        return crudo == null ? pordefecto : JSON.parse(crudo);
    } catch (error) {
        return pordefecto;
    }
};
const escribir = (clave, valor) => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (error) { /* almacenamiento lleno o bloqueado */ }
};

/**
 * Pone a la venta, al instante, a todo jugador que entre en la plantilla.
 *
 * Comprueba cada medio minuto mientras la app está abierta. Pilla los fichajes
 * vengan de donde vengan —cláusula pagada, puja ganada de madrugada u oferta
 * aceptada por otro—, porque mira la plantilla y no el gesto que la cambió.
 *
 * Con la app cerrada no corre: es la limitación de vivir en el navegador.
 */
const useAutoSell = (leagueId, teamId) => {
    const queryClient = useQueryClient();
    const trabajando = useRef(false);
    const activa = useAutoSellStore((s) => s.activa);
    const registrarVenta = useAutoSellStore((s) => s.registrarVenta);

    const revisar = useCallback(async () => {
        if (!leagueId || !teamId || trabajando.current) return;
        trabajando.current = true;
        try {
            const [datosEquipo, datosMercado] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: ['teamData', leagueId, teamId],
                    queryFn: () => fantasyAPI.getTeamData(leagueId, teamId),
                    staleTime: 0,
                }),
                queryClient.fetchQuery({
                    queryKey: ['market', leagueId],
                    queryFn: () => fantasyAPI.getMarket(leagueId),
                    staleTime: 0,
                }),
            ]);

            const payload = datosEquipo?.data || datosEquipo;
            const plantilla = cruzarPlantillaConMercado(payload?.players, extractArray(datosMercado));
            if (plantilla.length === 0) return;

            const clave = CLAVE_FOTO(leagueId, teamId);
            const anteriores = leer(clave, null);
            const { nuevos, esPrimeraVez, demasiados } = detectarFichajes(anteriores, plantilla);

            // La foto se guarda siempre, incluso si no se vende: así un caso
            // raro no deja el detector disparándose en cada comprobación.
            escribir(clave, idsDePlantilla(plantilla));
            if (esPrimeraVez || nuevos.length === 0) return;

            if (demasiados) {
                toast.error(`Venta automática detenida: ${nuevos.length} jugadores nuevos de golpe. `
                    + 'Revísalo a mano, que eso no parece un fichaje.');
                return;
            }

            for (const jugador of aPonerEnVenta(nuevos)) {
                const precio = precioDeVenta(jugador.valor);
                try {
                    const respuesta = await fantasyAPI.sellPlayerToMarket(leagueId, jugador.playerTeamId, precio);
                    if (isSuccessResponse(respuesta)) {
                        toast.success(`${jugador.nombre} puesto a la venta automáticamente`);
                        registrarVenta({ nombre: jugador.nombre, precio, cuando: Date.now() });
                    } else {
                        toast.error(`No se pudo anunciar a ${jugador.nombre}`);
                    }
                } catch (error) {
                    toast.error(`No se pudo anunciar a ${jugador.nombre}: ${error.message}`);
                }
            }
            await invalidateAfterMarketListing(queryClient, leagueId, teamId);
        } finally {
            trabajando.current = false;
        }
    }, [queryClient, leagueId, teamId, registrarVenta]);

    useEffect(() => {
        if (!activa || !leagueId || !teamId) return undefined;
        revisar();
        const id = setInterval(revisar, CADA);
        return () => clearInterval(id);
    }, [activa, leagueId, teamId, revisar]);

    return { maximoPorTanda: MAX_POR_TANDA };
};

export default useAutoSell;

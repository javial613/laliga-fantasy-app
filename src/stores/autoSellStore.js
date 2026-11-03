import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado de la venta automática de fichajes.
 *
 * Vive en un store y no en el componente de Configuración porque el vigilante
 * corre a nivel de aplicación: si dependiera de esa pantalla, solo vendería
 * mientras la tuvieras abierta, que es justo cuando no hace falta.
 *
 * Apagada de serie: es una acción que ocurre sin que estés mirando.
 */
export const useAutoSellStore = create(
    persist(
        (set) => ({
            activa: false,
            ultimaVenta: null,
            setActiva: (activa) => set({ activa: activa === true }),
            registrarVenta: (venta) => set({ ultimaVenta: venta }),
        }),
        {
            name: 'autoventa',
            partialize: (state) => ({ activa: state.activa, ultimaVenta: state.ultimaVenta }),
        }
    )
);

export default useAutoSellStore;

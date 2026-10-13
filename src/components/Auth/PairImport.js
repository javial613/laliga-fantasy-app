import React, { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { leerEmparejamientoDeHash, descodificarEmparejamiento } from '../../utils/pairingPayload';

/**
 * Entrada manual del enlace de emparejamiento, para el móvil.
 *
 * Escanear el QR con la cámara abre Safari, y en iOS el icono de la pantalla
 * de inicio guarda sus datos *aparte* del navegador: la sesión se quedaba en
 * Safari y al abrir desde el icono aparecía el login otra vez. Pegando aquí
 * el enlace, la sesión entra en el almacén del icono, que es donde hace falta.
 */
const PairImport = () => {
    const importarEmparejamiento = useAuthStore((state) => state.importarEmparejamiento);
    const [valor, setValor] = useState('');
    const [estado, setEstado] = useState(null);
    const [cargando, setCargando] = useState(false);

    // Se admite el enlace entero o solo el código: da igual lo que acabe
    // pegando el usuario.
    const extraer = (texto) => {
        const limpio = String(texto).trim();
        if (!limpio) return null;
        const almohadilla = limpio.indexOf('#');
        if (almohadilla !== -1) return leerEmparejamientoDeHash(limpio.slice(almohadilla));
        return descodificarEmparejamiento(limpio.replace(/^pair=/, ''));
    };

    const entrar = async (event) => {
        event.preventDefault();
        setEstado(null);
        const datos = extraer(valor);
        if (!datos) {
            setEstado('Ese enlace no vale. Cópialo entero desde el ordenador, desde Configuración → Conectar móvil.');
            return;
        }
        setCargando(true);
        const ok = await importarEmparejamiento(datos);
        setCargando(false);
        if (!ok) {
            setEstado('El enlace ha caducado o ya no sirve. Genera uno nuevo en el ordenador.');
        }
        // Si va bien, la pantalla de login desaparece sola.
    };

    return (
        <form onSubmit={entrar} className="bg-white/70 border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-5 h-5 text-gray-500" aria-hidden="true" />
                <h3 className="font-semibold text-gray-900">Conectar con el ordenador</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
                En la app del ordenador: <strong>Configuración → Conectar móvil → Copiar enlace</strong>.
                Pégalo aquí.
            </p>
            <input
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Pega aquí el enlace"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="input-field mb-3"
            />
            <button type="submit" disabled={cargando || !valor.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {cargando ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Entrando…</> : 'Entrar'}
            </button>
            {estado && <p className="mt-3 text-sm text-red-600">{estado}</p>}
        </form>
    );
};

export default PairImport;

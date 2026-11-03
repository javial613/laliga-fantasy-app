import React from 'react';
import PairPhone from './PairPhone';
import { sePuedeIniciarSesionInteractiva } from '../../services/interactiveLogin';

const Settings = () => {
  // El emparejamiento solo existe en la app de escritorio: es la que puede
  // abrir una sesión nueva contra LaLiga para dársela al móvil.
  const enEscritorio = sePuedeIniciarSesionInteractiva();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Configuración</h1>

      <PairPhone />

      {!enEscritorio && (
        <div className="card p-6">
          <p className="text-gray-500">
            Para conectar otro dispositivo, abre esta sección en la app de escritorio.
          </p>
        </div>
      )}
    </div>
  );
};

export default Settings;

import useMyTeamId from '../../hooks/useMyTeamId';
import useAutoSell from '../../hooks/useAutoSell';

/**
 * Pone en marcha la venta automática de fichajes en toda la aplicación.
 *
 * No pinta nada: va montado en el armazón para que vigile estés en la
 * pantalla que estés. Si colgara de Configuración, solo funcionaría mientras
 * tuvieras esa pantalla delante.
 */
const AutoSellRunner = () => {
    const { teamId, leagueId } = useMyTeamId();
    useAutoSell(leagueId, teamId);
    return null;
};

export default AutoSellRunner;

import { getAjusteManual, diasDesde } from './ajustesSaldo';

describe('getAjusteManual', () => {
    test('encuentra el ajuste sin distinguir mayúsculas ni espacios', () => {
        expect(getAjusteManual('Juanitoooo21', '017842199').importe).toBe(27000000);
        expect(getAjusteManual('  juanitoooo21  ', '017842199').importe).toBe(27000000);
        expect(getAjusteManual('JUANITOOOO21', '017842199').importe).toBe(27000000);
    });

    test('lleva el motivo, para poder mostrarlo en el desglose', () => {
        expect(getAjusteManual('Juanitoooo21', '017842199').motivo).toMatch(/cláusula/);
    });

    test('admite importes negativos, que suman al saldo en vez de restarlo', () => {
        expect(getAjusteManual('Yaguettou', '017842199').importe).toBe(-2700000);
    });

    test('quien no ve los anuncios no lleva ajuste', () => {
        expect(getAjusteManual('gonsalo3007', '018592924')).toBeNull();
    });

    test('tres días de cada siete se reparten como media diaria', () => {
        const dia = (d) => new Date(`${d}T12:00:00Z`);
        // Siete días después, lo acumulado son seis cuotas más: 42.857 x 6.
        const alEmpezar = getAjusteManual('Juanitoooo21', '018592924', dia('2026-10-16')).importe;
        const unaSemana = getAjusteManual('Juanitoooo21', '018592924', dia('2026-10-22')).importe;
        expect(alEmpezar - unaSemana).toBe(42857 * 6);
    });

    test('cada liga tiene sus propias correcciones', () => {
        // Con fecha fija: su ajuste ya incluye los ingresos diarios.
        expect(getAjusteManual('Juanitoooo21', '018592924', new Date('2026-10-16T12:00:00Z')).importe).toBe(2457143);
        // El mismo manager, otra liga, otra cifra.
        expect(getAjusteManual('Juanitoooo21', '017842199').importe).toBe(27000000);
        expect(getAjusteManual('Yaguettou', '018592924')).toBeNull();
    });

    test('no aplica correcciones de una liga en otra', () => {
        // El mismo manager en otra liga empieza con el saldo sin corregir.
        expect(getAjusteManual('Juanitoooo21', '999999999')).toBeNull();
        expect(getAjusteManual('Yaguettou', '999999999')).toBeNull();
    });

    test('sin liga no corrige nada', () => {
        expect(getAjusteManual('Yaguettou', undefined)).toBeNull();
        expect(getAjusteManual('Yaguettou', '')).toBeNull();
    });

    test('devuelve null para el resto de managers', () => {
        expect(getAjusteManual('Nadie', '017842199')).toBeNull();
        expect(getAjusteManual('', '017842199')).toBeNull();
        expect(getAjusteManual(null, '017842199')).toBeNull();
    });
});

describe('ajustes que se acumulan por días', () => {
    // Perogu ve a diario los anuncios que dan 100.000. El importe negativo suma.
    const el = (dia) => new Date(`${dia}T12:00:00Z`);

    test('el primer día ya cuenta', () => {
        expect(diasDesde('2026-10-16', el('2026-10-16'))).toBe(1);
        expect(getAjusteManual('Perogu', '018592924', el('2026-10-16')).importe).toBe(-1100000);
    });

    test('suma un día más cada jornada', () => {
        expect(getAjusteManual('Perogu', '018592924', el('2026-10-17')).importe).toBe(-1200000);
        expect(getAjusteManual('Perogu', '018592924', el('2026-10-26')).importe).toBe(-2100000);
    });

    test('se combina con el importe fijo sin perderlo', () => {
        // Juanito: 2,5M a restar y los anuncios de 3 días por semana, que son
        // 42.857 de media diaria y suman.
        expect(getAjusteManual('Juanitoooo21', '018592924', el('2026-10-16')).importe).toBe(2457143);
        expect(getAjusteManual('Juanitoooo21', '018592924', el('2026-10-22')).importe).toBe(2200001);
    });

    test('antes de la fecha de inicio no acumula nada', () => {
        expect(diasDesde('2026-10-16', el('2026-10-15'))).toBe(0);
        expect(getAjusteManual('Perogu', '018592924', el('2026-10-15')).importe).toBe(-1000000);
    });

    test('el motivo dice de dónde sale, que si no parece un error', () => {
        const ajuste = getAjusteManual('Perogu', '018592924', el('2026-10-18'));
        expect(ajuste.motivo).toContain('100.000€/día');
        expect(ajuste.motivo).toContain('3 días');
    });

    test('una fecha inservible no rompe el saldo', () => {
        expect(diasDesde('no es fecha', el('2026-10-18'))).toBe(0);
        expect(diasDesde('2026-10-16', new Date('x'))).toBe(0);
    });

    test('los ajustes sin parte diaria siguen igual', () => {
        const ajuste = getAjusteManual('Yaguettou', '017842199', el('2027-01-01'));
        expect(ajuste.importe).toBe(-2700000);
        expect(ajuste.motivo).not.toContain('día');
    });
});

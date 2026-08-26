import { getAjusteManual } from './ajustesSaldo';

describe('getAjusteManual', () => {
    test('encuentra el ajuste sin distinguir mayúsculas ni espacios', () => {
        expect(getAjusteManual('Juanitoooo21').importe).toBe(2000000);
        expect(getAjusteManual('  juanitoooo21  ').importe).toBe(2000000);
        expect(getAjusteManual('JUANITOOOO21').importe).toBe(2000000);
    });

    test('lleva el motivo, para poder mostrarlo en el desglose', () => {
        expect(getAjusteManual('Juanitoooo21').motivo).toMatch(/cláusula/);
    });

    test('devuelve null para el resto de managers', () => {
        expect(getAjusteManual('Yaguettou')).toBeNull();
        expect(getAjusteManual('')).toBeNull();
        expect(getAjusteManual(null)).toBeNull();
    });
});

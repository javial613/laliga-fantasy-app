import { getAjusteManual } from './ajustesSaldo';

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

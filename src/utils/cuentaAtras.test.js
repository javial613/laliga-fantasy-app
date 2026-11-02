import { formatearRestante, intervaloDeRefresco } from './cuentaAtras';

const s = 1000, m = 60 * s, h = 60 * m, d = 24 * h;

describe('formato de cuenta atrás', () => {
    test('por debajo de un minuto, solo segundos', () => {
        expect(formatearRestante(41 * s)).toBe('41s');
        expect(formatearRestante(1 * s)).toBe('1s');
    });

    test('por debajo de una hora, minutos y segundos', () => {
        expect(formatearRestante(12 * m + 5 * s)).toBe('12m 05s');
        expect(formatearRestante(59 * m + 59 * s)).toBe('59m 59s');
    });

    test('por debajo de un día, horas y minutos', () => {
        expect(formatearRestante(3 * h + 7 * m)).toBe('3h 07m');
        // El caso que motivó esto: antes ponía "1 hora" con 59 minutos o con 2.
        expect(formatearRestante(1 * h + 2 * m)).toBe('1h 02m');
    });

    test('a partir de un día, días y horas', () => {
        expect(formatearRestante(2 * d + 5 * h)).toBe('2d 5h');
    });

    test('lo vencido se dice, no se muestra en negativo', () => {
        expect(formatearRestante(0)).toBe('expirado');
        expect(formatearRestante(-5000)).toBe('expirado');
        expect(formatearRestante(null)).toBe('expirado');
        expect(formatearRestante(NaN)).toBe('expirado');
    });
});

describe('ritmo de repintado', () => {
    test('al segundo en la última hora', () => {
        expect(intervaloDeRefresco(30 * m)).toBe(1000);
    });

    test('más espaciado cuanto más queda', () => {
        expect(intervaloDeRefresco(5 * h)).toBe(30000);
        expect(intervaloDeRefresco(3 * d)).toBe(300000);
    });

    test('nada que refrescar si ya expiró', () => {
        expect(intervaloDeRefresco(0)).toBeNull();
        expect(intervaloDeRefresco(-1)).toBeNull();
    });
});

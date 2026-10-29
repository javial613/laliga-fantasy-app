import { calcularVentanaClausulas, describirLimite, HORAS_DE_CIERRE } from './ventanaClausulas';

const H = 3600000;
const apertura = '2026-10-30T21:00:00+01:00';   // jornada 11
const siguiente = '2026-11-06T21:00:00+01:00';  // jornada 12
const instante = (s) => new Date(s).getTime();

describe('ventana de cláusulas', () => {
    test('cierra 24 horas antes del primer partido', () => {
        const v = calcularVentanaClausulas(apertura, siguiente, instante('2026-10-29T10:00:00+01:00'));
        expect(v.limite).toBe(instante('2026-10-29T21:00:00+01:00'));
        expect(v.cerradaLaEnCurso).toBe(false);
        expect(HORAS_DE_CIERRE).toBe(24);
    });

    test('justo en el instante del cierre todavía se llega', () => {
        const v = calcularVentanaClausulas(apertura, siguiente, instante('2026-10-29T21:00:00+01:00'));
        expect(v.limite).toBe(instante('2026-10-29T21:00:00+01:00'));
    });

    test('pasado el cierre, el plazo que cuenta es el de la jornada siguiente', () => {
        const v = calcularVentanaClausulas(apertura, siguiente, instante('2026-10-29T21:00:01+01:00'));
        expect(v.limite).toBe(instante('2026-11-05T21:00:00+01:00'));
        expect(v.cerradaLaEnCurso).toBe(true);
    });

    test('durante la jornada tampoco se puede: toca esperar a la siguiente', () => {
        const v = calcularVentanaClausulas(apertura, siguiente, instante('2026-10-31T18:00:00+01:00'));
        expect(v.limite).toBe(instante('2026-11-05T21:00:00+01:00'));
    });

    test('sin fechas no se inventa un plazo', () => {
        expect(calcularVentanaClausulas(null, null, Date.now()).limite).toBeNull();
        expect(calcularVentanaClausulas('no es fecha', null, Date.now()).limite).toBeNull();
    });

    test('si falta la siguiente pero la actual ya cerró, no hay plazo que dar', () => {
        const v = calcularVentanaClausulas(apertura, null, instante('2026-10-31T18:00:00+01:00'));
        expect(v.limite).toBeNull();
    });
});

describe('descripción del plazo', () => {
    test('avisa de las horas que quedan', () => {
        const limite = instante('2026-10-29T21:00:00+01:00');
        expect(describirLimite(limite, instante('2026-10-29T10:00:00+01:00'))).toMatch(/quedan 11 h/);
    });

    test('con más de dos días lo dice en días', () => {
        const limite = instante('2026-11-05T21:00:00+01:00');
        expect(describirLimite(limite, instante('2026-11-01T21:00:00+01:00'))).toMatch(/quedan 4 días/);
    });

    test('en la última hora lo deja claro', () => {
        const limite = instante('2026-10-29T21:00:00+01:00');
        expect(describirLimite(limite, instante('2026-10-29T20:30:00+01:00'))).toMatch(/menos de 1 hora/);
    });

    test('sin plazo no devuelve texto', () => {
        expect(describirLimite(null)).toBeNull();
    });
});

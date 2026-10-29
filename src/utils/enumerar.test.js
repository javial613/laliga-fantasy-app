import { enumerar } from '../components/Teams/VulnerabilidadAlineacion';

describe('enumerar nombres', () => {
    test('uno, dos y tres se leen bien', () => {
        expect(enumerar(['Ana'])).toBe('Ana');
        expect(enumerar(['Ana', 'Bea'])).toBe('Ana y Bea');
        expect(enumerar(['Ana', 'Bea', 'Caro'])).toBe('Ana, Bea y Caro');
    });

    test('lista vacía no devuelve basura', () => {
        expect(enumerar([])).toBe('');
    });
});

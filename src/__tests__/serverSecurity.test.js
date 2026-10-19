// Testea la validación de origen del proxy (server/security.js). El módulo es
// CommonJS puro sin dependencias, por lo que se puede requerir desde la suite
// de CRA aunque viva fuera de src/.
const { isOriginAllowed, isSameOrigin } = require('../../server/security');

describe('isOriginAllowed', () => {
    test('coincide con orígenes exactos de la lista', () => {
        const allowed = ['http://localhost:3005', 'https://miapp.example'];
        expect(isOriginAllowed('http://localhost:3005', allowed)).toBe(true);
        expect(isOriginAllowed('https://miapp.example', allowed)).toBe(true);
        expect(isOriginAllowed('https://otra.example', allowed)).toBe(false);
    });

    test("'*' permite cualquier origen", () => {
        expect(isOriginAllowed('https://cualquiera.example', ['*'])).toBe(true);
    });

    test('los comodines de prefijo cubren cualquier puerto', () => {
        const allowed = ['http://localhost:*', 'http://192.168.1.*'];
        expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true);
        expect(isOriginAllowed('http://localhost:65535', allowed)).toBe(true);
        expect(isOriginAllowed('http://192.168.1.50:3005', allowed)).toBe(true);
        expect(isOriginAllowed('http://otrohost:3000', allowed)).toBe(false);
    });

    test('un origen sin puerto explícito (puerto 80) NO coincide con el comodín de puerto', () => {
        // Los navegadores omiten ":80" en el header Origin; 'http://localhost:*'
        // exige los dos puntos, así que 'http://localhost' queda fuera.
        expect(isOriginAllowed('http://localhost', ['http://localhost:*'])).toBe(false);
    });

    test("'app://.' acepta el esquema app:// de Electron", () => {
        expect(isOriginAllowed('app://./index.html', ['app://.'])).toBe(true);
        expect(isOriginAllowed('app://loquesea', ['app://.'])).toBe(true);
        expect(isOriginAllowed('file://algo', ['app://.'])).toBe(false);
    });

    test('origen nulo o vacío se rechaza (el middleware decide con allowNullOrigin)', () => {
        expect(isOriginAllowed(null, ['*'])).toBe(false);
        expect(isOriginAllowed(undefined, ['*'])).toBe(false);
        expect(isOriginAllowed('', ['*'])).toBe(false);
    });

    test('lista vacía rechaza todo', () => {
        expect(isOriginAllowed('http://localhost:3005', [])).toBe(false);
    });
});

describe('isSameOrigin', () => {
    // Las escrituras del navegador sí mandan Origin, al contrario que las
    // lecturas: sin esto, la propia app podía leer pero no actuar.
    test('acepta a la página servida por este mismo servidor', () => {
        expect(isSameOrigin('https://laliga-fantasy-fawn.vercel.app', {
            host: 'laliga-fantasy-fawn.vercel.app',
        })).toBe(true);
    });

    test('detrás de un CDN manda x-forwarded-host', () => {
        expect(isSameOrigin('https://mi-app.vercel.app', {
            host: 'origen-interno.vercel.app',
            'x-forwarded-host': 'mi-app.vercel.app',
        })).toBe(true);
    });

    test('con varios saltos vale el primero de la lista', () => {
        expect(isSameOrigin('https://mi-app.vercel.app', {
            'x-forwarded-host': 'mi-app.vercel.app, interno.local',
        })).toBe(true);
    });

    test('rechaza a cualquier otro sitio', () => {
        expect(isSameOrigin('https://otro-sitio.com', { host: 'mi-app.vercel.app' })).toBe(false);
        expect(isSameOrigin('https://mi-app.vercel.app.malo.com', { host: 'mi-app.vercel.app' })).toBe(false);
    });

    test('no se cae con entradas incompletas o absurdas', () => {
        expect(isSameOrigin('', { host: 'x' })).toBe(false);
        expect(isSameOrigin('https://x', {})).toBe(false);
        expect(isSameOrigin('no es una url', { host: 'x' })).toBe(false);
        expect(isSameOrigin('https://x', undefined)).toBe(false);
    });

    test('el puerto cuenta: otro puerto es otro origen', () => {
        expect(isSameOrigin('http://localhost:3006', { host: 'localhost:3005' })).toBe(false);
        expect(isSameOrigin('http://localhost:3005', { host: 'localhost:3005' })).toBe(true);
    });
});

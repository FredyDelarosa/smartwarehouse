/**
 * Servidor estático mínimo para probar el build de producción.
 *
 * `ng serve` no sirve: el service worker solo se genera en el build de
 * producción, así que para comprobar que la PWA funciona de verdad hay que
 * servir `dist/` como lo hará el hosting real.
 *
 * Hace dos cosas que `http-server` no hace bien aquí:
 *   1. **Fallback a index.html**: la app es cliente y usa rutas como
 *      `/productos/1`; sin fallback, un F5 en esa URL daría un 404.
 *   2. **Proxy de `/api/v1`** hacia `localhost:8000`: `environment.prod.ts`
 *      usa una ruta relativa, igual que en desarrollo.
 *
 * Uso:  node scripts/servir-dist.mjs [puerto]
 */

import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist/SmartWarehouse/browser');
const PUERTO = Number(process.argv[2] ?? 4300);
const API = 'http://localhost:8000';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Ejecuta primero: npm run build:prod`);
  process.exit(1);
}

function proxy(req, res) {
  const hacia = API + req.url;
  const opciones = {
    hostname: 'localhost',
    port: 8000,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:8000' },
  };
  const puente = httpRequest(opciones, (arriba) => {
    res.writeHead(arriba.statusCode ?? 502, arriba.headers);
    arriba.pipe(res);
  });
  puente.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error_code: 'PROXY_ERROR', message: e.message }));
  });
  req.pipe(puente);
}

const servidor = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return proxy(req, res);

  // `normalize` + el prefijo impide que `..` salga de dist/.
  const url = new URL(req.url ?? '/', `http://localhost:${PUERTO}`);
  let ruta = join(DIST, normalize(decodeURIComponent(url.pathname)));
  if (!ruta.startsWith(DIST)) ruta = DIST;

  if (existsSync(ruta) && statSync(ruta).isDirectory()) {
    ruta = join(ruta, 'index.html');
  }

  // Fallback SPA: cualquier ruta desconocida devuelve index.html.
  if (!existsSync(ruta)) ruta = join(DIST, 'index.html');

  const tipo = TIPOS[extname(ruta)] ?? 'application/octet-stream';
  // El service worker no debe quedar cacheado por el navegador, o una versión
  // nueva seguiría sirviéndose la vieja.
  const extra = ruta.endsWith('ngsw-worker.js') ? ', no-cache' : '';
  res.writeHead(200, { 'Content-Type': `${tipo}${extra}` });
  createReadStream(ruta).pipe(res);
});

servidor.listen(PUERTO, () => {
  console.log(`Sirviendo dist/ en http://localhost:${PUERTO}`);
  console.log(`  app  : http://localhost:${PUERTO}/`);
  console.log(`  proxy: /api/v1 -> ${API}`);
});
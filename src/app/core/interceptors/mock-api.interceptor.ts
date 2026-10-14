import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { TokenResponse } from '../models/auth.model';
import type { ApiErrorBody } from '../models/error.model';
import {
  MOCK_BUSQUEDAS,
  MOCK_CATEGORIAS,
  MOCK_INCIDENCIAS,
  MOCK_MOVIMIENTOS,
  MOCK_PRODUCTOS,
  MOCK_UBICACIONES,
  MOCK_USUARIOS,
  alertasStock,
  buscarProductos,
  busquedaIniciada,
  comparativa,
  dashboardResumen,
  resumenIncidencias,
  resumenMovimientos,
  stockProducto,
  stockTotal,
  tiempoPromedio,
} from '../services/mock-data';

/** Estado mutable del mock (búsqueda en curso, tokens). */
interface MockState {
  busquedaSeq: number;
  accessToken: string | null;
  refreshToken: string | null;
}

const state: MockState = {
  busquedaSeq: 1000,
  accessToken: null,
  refreshToken: null,
};

/**
 * Backend simulado para desarrollo.
 *
 * Se registra SOLO si `environment.useMockApi` es true (nunca en producción),
 * y se coloca ANTES de jwt/error para que la app no necesite cambios.
 *
 * Contrato: devuelve exactamente las mismas rutas, query params, códigos HTTP
 * y cuerpos que el backend documentado en API_FRONTEND.md.
 */
/**
 * Normaliza el cuerpo de la petición a objeto.
 *
 * Con `provideHttpClient(withFetch())` el body puede llegar YA serializado
 * como string JSON en lugar de objeto, según cuándo lo procese el backend.
 * Sin esta normalización, `body?.['email']` daba `undefined` y el login del
 * mock respondía 401 con credenciales correctas.
 */
function asRecord(body: unknown): Record<string, unknown> | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return null;
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMockApi || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const path = req.url.slice(environment.apiUrl.length) || '/';
  const method = req.method.toUpperCase();
  const body = asRecord(req.body);

  const handler = route(method, path, req.params, body, req);
  if (!handler) {
    return fail(404, 'NOT_FOUND', `Ruta no implementada en el mock: ${method} ${path}`);
  }

  const latency = environment.mockLatencyMs;
  // `handler` mezcla respuestas 200 y errores con tipos distintos; para el
  // mock es irrelevante, así que se homogeneiza al tipo del interceptor.
  const respuesta = latency > 0 ? handler.pipe(delay(latency)) : handler;
  return respuesta as unknown as Observable<HttpEvent<unknown>>;
};

// ── Enrutador ───────────────────────────────────────────────────────────
function route(
  method: string,
  path: string,
  params: { has(p: string): boolean; get(p: string): string | null },
  body: Record<string, unknown> | null,
  req: Parameters<HttpInterceptorFn>[0],
): Observable<unknown> | null {
  const clean = path.replace(/\/+$/, '') || '/';

  // ── Auth ──
  if (clean === '/auth/login' && method === 'POST') {
    const email = String(body?.['email'] ?? '').toLowerCase();
    const password = String(body?.['password'] ?? '');
    const user = MOCK_USUARIOS.find((u) => u.email.toLowerCase() === email);

    if (!user) return fail(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas.');
    if (password !== 'Demo1234!') {
      return fail(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas.');
    }

    state.accessToken = `mock.${user.id}.${++state.busquedaSeq}`;
    state.refreshToken = `mock.refresh.${user.id}`;
    return ok<TokenResponse>({
      access_token: state.accessToken,
      refresh_token: state.refreshToken,
      token_type: 'bearer',
      expires_in: 28800,
    });
  }

  if (clean === '/auth/refresh' && method === 'POST') {
    if (!state.refreshToken) {
      return fail(401, 'NO_REFRESH_TOKEN', 'No hay sesión para renovar.');
    }
    state.accessToken = `mock.refreshed.${++state.busquedaSeq}`;
    return ok<TokenResponse>({
      access_token: state.accessToken,
      refresh_token: state.refreshToken,
      token_type: 'bearer',
      expires_in: 28800,
    });
  }

  if (clean === '/auth/me' && method === 'GET') {
    const user = resolveUser(req.headers.get('Authorization'));
    return user ? ok(user) : fail(401, 'UNAUTHORIZED', 'Sesión no válida.');
  }

  if (clean === '/auth/change-password' && method === 'POST') {
    const user = resolveUser(req.headers.get('Authorization'));
    if (!user) return fail(401, 'UNAUTHORIZED', 'Sesión no válida.');
    const nuevo = String(body?.['new_password'] ?? '');
    if (nuevo.length < 8) {
      return fail(422, 'VALIDATION_ERROR', 'La nueva contraseña debe tener al menos 8 caracteres.', {
        new_password: ['too_short'],
      });
    }
    return noContent();
  }

  // ── Productos ──
  if (clean === '/productos' && method === 'GET') return listProductos(params);
  if (clean === '/productos/buscar' && method === 'GET') return listBuscarProductos(params);
  if (clean === '/productos' && method === 'POST') return createProducto(body);

  const productoId = matchId(clean, '/productos/');
  if (productoId !== null) {
    const existing = MOCK_PRODUCTOS.find((p) => p.id === productoId);
    if (!existing) return fail(404, 'PRODUCTO_NOT_FOUND', 'Producto no encontrado.');
    if (method === 'GET') return ok(existing);
    if (method === 'PATCH') return updateProducto(existing, body);
    if (method === 'DELETE') {
      // Baja lógica: el producto sigue en el listado con activo=false.
      if (userRol() !== 'Administrador') {
        return fail(403, 'FORBIDDEN', 'Solo un Administrador puede dar de baja productos.');
      }
      existing.activo = false;
      return noContent();
    }
  }

  // ── Categorías ──
// El backend real NO expone este endpoint todavía (PET-1 en DECISIONS.md).
// El mock sí, para poder desarrollar y demostrar el formulario completo.
if (clean === '/categorias' && method === 'GET') {
    return ok(MOCK_CATEGORIAS);
  }

  // ── Ubicaciones ──
  if (clean === '/ubicaciones' && method === 'GET') return listUbicaciones(params);
  if (clean === '/ubicaciones' && method === 'POST') return createUbicacion(body);

  const almacenMatch = clean.match(/^\/ubicaciones\/almacen\/(\d+)$/);
  if (almacenMatch && method === 'GET') {
    const almacenId = Number(almacenMatch[1]);
    return ok(filterByParams(MOCK_UBICACIONES, params, (u) => u.almacen_id === almacenId));
  }

  const qrMatch = clean.match(/^\/ubicaciones\/qr\/(.+)$/);
  if (qrMatch && method === 'GET') {
    const codigo = decodeURIComponent(qrMatch[1]!);
    const ubicacion = MOCK_UBICACIONES.find(
      (u) => u.codigo_qr === codigo || u.codigo_ubicacion === codigo,
    );
    if (!ubicacion) return fail(404, 'UBICACION_NOT_FOUND', `Código QR desconocido: ${codigo}`);
    return ok({
      ubicacion,
      productos: stockProductoEntries(ubicacion.id),
    });
  }

  const ubicacionId = matchId(clean, '/ubicaciones/');
  if (ubicacionId !== null && method === 'GET') {
    const u = MOCK_UBICACIONES.find((x) => x.id === ubicacionId);
    return u ? ok(u) : fail(404, 'UBICACION_NOT_FOUND', 'Ubicación no encontrada.');
  }

  // ── Inventario ──
  const invMatch = clean.match(/^\/inventario\/producto\/(\d+)$/);
  if (invMatch && method === 'GET') {
    const stock = stockProducto(Number(invMatch[1]));
    return stock
      ? ok(stock)
      : fail(404, 'PRODUCTO_NOT_FOUND', 'Producto no encontrado.');
  }

  if (clean === '/inventario/alertas' && method === 'GET') return ok(alertasStock());

  // ── Movimientos ──
  if (clean === '/movimientos/entrada' && method === 'POST') return crearMovimiento('ENTRADA', body);
  if (clean === '/movimientos/salida' && method === 'POST') return crearMovimiento('SALIDA', body);
  if (clean === '/movimientos/traslado' && method === 'POST') return crearMovimiento('TRASLADO', body);

  if (clean === '/movimientos' && method === 'GET') {
    let lista = [...MOCK_MOVIMIENTOS];
    const p = params.get('producto_id');
    if (p) lista = lista.filter((m) => m.producto_id === Number(p));
    const u = params.get('usuario_id');
    if (u) lista = lista.filter((m) => m.usuario_id === Number(u));
    const t = params.get('tipo');
    if (t) lista = lista.filter((m) => m.tipo === t);
    const loc = params.get('ubicacion_id');
    if (loc) {
      const id = Number(loc);
      lista = lista.filter((m) => m.ubicacion_origen_id === id || m.ubicacion_destino_id === id);
    }
    return ok(paginate(lista, params));
  }

  // ── Búsquedas ──
  if (clean === '/busquedas/iniciar' && method === 'POST') {
    const termino = String(body?.['termino_busqueda'] ?? '').trim();
    const productoId = (body?.['producto_id'] as number | null) ?? null;

    const producto =
      productoId !== null
        ? (MOCK_PRODUCTOS.find((p) => p.id === productoId) ?? null)
        : (buscarProductos(termino)[0] ?? null);

    return ok(busquedaIniciada(producto, ++state.busquedaSeq));
  }

  const finalizarMatch = clean.match(/^\/busquedas\/(\d+)\/finalizar$/);
  if (finalizarMatch && method === 'POST') {
    const ubicacionId = Number(body?.['ubicacion_encontrada_id'] ?? 0);
    const u = MOCK_UBICACIONES.find((x) => x.id === ubicacionId);
    if (!u) return fail(422, 'VALIDATION_ERROR', 'La ubicación indicada no existe.');

    const segundos = 45 + Math.floor(Math.random() * 180);
    MOCK_BUSQUEDAS.unshift({
      id: MOCK_BUSQUEDAS.length + 1,
      termino_busqueda: u.codigo_ubicacion,
      producto_id: null,
      producto_nombre: null,
      exito: true,
      tiempo_busqueda_segundos: segundos,
      fecha: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });

    return ok({ exito: true, tiempo_busqueda_segundos: segundos });
  }

  if (clean === '/busquedas/historial' && method === 'GET') {
    return ok(paginate(MOCK_BUSQUEDAS, params));
  }

  // ── Incidencias ──
  if (clean === '/incidencias' && method === 'GET') return listIncidencias(params);

  if (clean === '/incidencias' && method === 'POST') {
    const tipo = String(body?.['tipo'] ?? '') as (typeof MOCK_INCIDENCIAS)[number]['tipo'];
    if (!['MAL_UBICADO', 'FALTANTE', 'DANADO', 'OTRO'].includes(tipo)) {
      return fail(422, 'VALIDATION_ERROR', 'Tipo de incidencia inválido.');
    }
    const nueva = {
      id: MOCK_INCIDENCIAS.length + 1,
      tipo,
      producto_id: (body?.['producto_id'] as number | null) ?? null,
      ubicacion_id: (body?.['ubicacion_id'] as number | null) ?? null,
      usuario_id: 1,
      fecha: new Date().toISOString().replace('T', ' ').slice(0, 19),
      descripcion: String(body?.['descripcion'] ?? ''),
      resuelta: false,
      fecha_resolucion: null,
    };
    MOCK_INCIDENCIAS.unshift(nueva);
    return ok(nueva);
  }

  const resolverMatch = clean.match(/^\/incidencias\/(\d+)\/resolver$/);
  if (resolverMatch && method === 'POST') {
    const rol = userRol();
    if (rol !== 'Supervisor' && rol !== 'Almacenero' && rol !== 'Administrador') {
      return fail(403, 'FORBIDDEN', 'No tienes permisos para resolver incidencias.');
    }
    const inc = MOCK_INCIDENCIAS.find((i) => i.id === Number(resolverMatch[1]));
    if (!inc) return fail(404, 'INCIDENCIA_NOT_FOUND', 'Incidencia no encontrada.');
    inc.resuelta = true;
    inc.fecha_resolucion = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return ok(inc);
  }

  // ── Métricas ──
  if (clean === '/metricas/dashboard' && method === 'GET') return ok(dashboardResumen());
  if (clean === '/metricas/tiempo-promedio' && method === 'GET') {
    return ok(tiempoPromedio(params.get('desde') ?? undefined, params.get('hasta') ?? undefined));
  }
  if (clean === '/metricas/comparativa' && method === 'GET') {
    const d = {
      desde_anterior: params.get('desde_anterior'),
      hasta_anterior: params.get('hasta_anterior'),
      desde_actual: params.get('desde_actual'),
      hasta_actual: params.get('hasta_actual'),
    };
    const faltantes = Object.entries(d).filter(([, v]) => !v).map(([k]) => k);
    if (faltantes.length) {
      return fail(
        422,
        'VALIDATION_ERROR',
        `Faltan parámetros obligatorios: ${faltantes.join(', ')}`,
      );
    }
    return ok(
      comparativa(d.desde_anterior!, d.hasta_anterior!, d.desde_actual!, d.hasta_actual!),
    );
  }
  if (clean === '/metricas/incidencias' && method === 'GET') return ok(resumenIncidencias());
  if (clean === '/metricas/movimientos' && method === 'GET') return ok(resumenMovimientos());

  return null;
}

// ── Handlers ────────────────────────────────────────────────────────────
function listProductos(params: ParamSource) {
  let lista = [...MOCK_PRODUCTOS];
  const cat = params.get('categoria_id');
  if (cat) lista = lista.filter((p) => p.categoria_id === Number(cat));
  if (params.get('solo_activos') === 'true') lista = lista.filter((p) => p.activo);
  return ok(paginate(lista, params));
}

function listBuscarProductos(params: ParamSource) {
  const termino = params.get('termino');
  if (!termino || termino.trim().length === 0) {
    return fail(422, 'VALIDATION_ERROR', 'El parámetro "termino" es obligatorio.');
  }
  const limite = Math.min(Number(params.get('limit') ?? 20), 100);
  return ok(buscarProductos(termino).slice(0, limite));
}

function createProducto(body: Record<string, unknown> | null) {
  const rol = userRol();
  if (rol !== 'Administrador' && rol !== 'Supervisor') {
    return fail(403, 'FORBIDDEN', 'Necesitas rol Administrador o Supervisor para crear productos.');
  }

  const codigo = String(body?.['codigo'] ?? '').trim();
  const nombre = String(body?.['nombre'] ?? '').trim();

  if (!codigo || !nombre) {
    return fail(422, 'VALIDATION_ERROR', 'El código y el nombre son obligatorios.', {
      campos: ['codigo', 'nombre'],
    });
  }
  if (MOCK_PRODUCTOS.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())) {
    return fail(409, 'PRODUCTO_DUPLICADO', `Ya existe un producto con el código ${codigo}.`);
  }

  const nuevo = {
    id: Math.max(...MOCK_PRODUCTOS.map((p) => p.id)) + 1,
    codigo,
    nombre,
    descripcion: (body?.['descripcion'] as string | null) ?? null,
    categoria_id: (body?.['categoria_id'] as number | null) ?? null,
    unidad_medida: String(body?.['unidad_medida'] ?? 'pieza'),
    stock_minimo: Number(body?.['stock_minimo'] ?? 0),
    foto_url: (body?.['foto_url'] as string | null) ?? null,
    activo: body?.['activo'] !== false,
    fecha_creacion: new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString(),
  };
  MOCK_PRODUCTOS.push(nuevo);
  return ok(nuevo);
}

function updateProducto(
  existing: (typeof MOCK_PRODUCTOS)[number],
  body: Record<string, unknown> | null,
) {
  const rol = userRol();
  if (rol !== 'Administrador' && rol !== 'Supervisor') {
    return fail(403, 'FORBIDDEN', 'Necesitas rol Administrador o Supervisor para editar productos.');
  }
  Object.assign(existing, {
    nombre: body?.['nombre'] ?? existing.nombre,
    descripcion: body?.['descripcion'] ?? existing.descripcion,
    categoria_id: body?.['categoria_id'] ?? existing.categoria_id,
    unidad_medida: body?.['unidad_medida'] ?? existing.unidad_medida,
    stock_minimo: body?.['stock_minimo'] ?? existing.stock_minimo,
    foto_url: body?.['foto_url'] ?? existing.foto_url,
    activo: body?.['activo'] ?? existing.activo,
    fecha_actualizacion: new Date().toISOString(),
  });
  return ok(existing);
}

function listUbicaciones(params: ParamSource) {
  let lista = [...MOCK_UBICACIONES];
  const almacen = params.get('almacen_id');
  if (almacen) lista = lista.filter((u) => u.almacen_id === Number(almacen));
  if (params.get('solo_activas') !== 'false') lista = lista.filter((u) => u.activo);
  return ok(paginate(lista, params));
}

function createUbicacion(body: Record<string, unknown> | null) {
  if (userRol() !== 'Administrador') {
    return fail(403, 'FORBIDDEN', 'Solo un Administrador puede crear ubicaciones.');
  }
  const pasillo = String(body?.['pasillo'] ?? '').trim();
  const estante = String(body?.['estante'] ?? '').trim();
  const nivel = String(body?.['nivel'] ?? '').trim();

  if (!pasillo || !estante || !nivel) {
    return fail(422, 'VALIDATION_ERROR', 'Pasillo, estante y nivel son obligatorios.');
  }

  const codigo = `${pasillo}-${estante}-${nivel}`;
  if (MOCK_UBICACIONES.some((u) => u.codigo_ubicacion === codigo)) {
    return fail(409, 'UBICACION_DUPLICADA', `La ubicación ${codigo} ya existe.`);
  }

  const nueva = {
    id: Math.max(...MOCK_UBICACIONES.map((u) => u.id)) + 1,
    almacen_id: 1,
    pasillo,
    estante,
    nivel,
    codigo_ubicacion: codigo,
    codigo_qr: String(body?.['codigo_qr'] ?? `QR-${codigo}`),
    coordenada_x: (body?.['coordenada_x'] as string | null) ?? null,
    coordenada_y: (body?.['coordenada_y'] as string | null) ?? null,
    activo: body?.['activo'] !== false,
    created_at: new Date().toISOString(),
  };
  MOCK_UBICACIONES.push(nueva);
  return ok(nueva);
}

function crearMovimiento(tipo: string, body: Record<string, unknown> | null) {
  const rol = userRol();
  if (rol !== 'Almacenero' && rol !== 'Supervisor' && rol !== 'Administrador') {
    return fail(403, 'FORBIDDEN', 'No tienes permisos para registrar movimientos.');
  }

  const productoId = Number(body?.['producto_id'] ?? 0);
  const cantidad = Number(body?.['cantidad'] ?? 0);
  const producto = MOCK_PRODUCTOS.find((p) => p.id === productoId);

  if (!producto) return fail(422, 'VALIDATION_ERROR', 'Selecciona un producto válido.');
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return fail(422, 'VALIDATION_ERROR', 'La cantidad debe ser mayor que cero.');
  }

  if (tipo === 'SALIDA' && stockTotal(productoId) < cantidad) {
    return fail(
      409,
      'STOCK_INSUFICIENTE',
      `Stock insuficiente: hay ${stockTotal(productoId)} ${producto.unidad_medida} y se intentan retirar ${cantidad}.`,
    );
  }

  const movimiento = {
    id: MOCK_MOVIMIENTOS.length + 1,
    tipo: tipo as (typeof MOCK_MOVIMIENTOS)[number]['tipo'],
    producto_id: productoId,
    cantidad,
    ubicacion_origen_id: (body?.['ubicacion_origen_id'] as number | null) ?? null,
    ubicacion_destino_id: (body?.['ubicacion_destino_id'] as number | null) ?? null,
    usuario_id: 1,
    fecha: new Date().toISOString().replace('T', ' ').slice(0, 19),
    referencia: (body?.['referencia'] as string | null) ?? null,
    observaciones: (body?.['observaciones'] as string | null) ?? null,
  };
  MOCK_MOVIMIENTOS.unshift(movimiento);
  return ok(movimiento);
}

function listIncidencias(params: ParamSource) {
  let lista = [...MOCK_INCIDENCIAS];
  const tipo = params.get('tipo');
  if (tipo) lista = lista.filter((i) => i.tipo === tipo);
  const resuelta = params.get('resuelta');
  if (resuelta !== null && resuelta !== '') {
    const flag = resuelta === 'true';
    lista = lista.filter((i) => i.resuelta === flag);
  }
  const producto = params.get('producto_id');
  if (producto) lista = lista.filter((i) => i.producto_id === Number(producto));
  const desde = params.get('desde');
  if (desde) lista = lista.filter((i) => i.fecha >= desde);
  const hasta = params.get('hasta');
  if (hasta) lista = lista.filter((i) => i.fecha <= `${hasta} 23:59:59`);
  return ok(paginate(lista, params));
}

function stockProductoEntries(ubicacionId: number) {
  const out: { producto_id: number; codigo: string; nombre: string; cantidad: number }[] = [];
  for (const p of MOCK_PRODUCTOS) {
    const stock = stockProducto(p.id);
    const hit = stock?.distribucion.find((d) => d.ubicacion_id === ubicacionId);
    if (hit) {
      out.push({ producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: hit.cantidad });
    }
  }
  return out;
}

// ── Utilidades ──────────────────────────────────────────────────────────
type ParamSource = {
  get(name: string): string | null;
  has(name: string): boolean;
};

/** Aplica skip/limit como hace el backend. */
function paginate<T>(lista: T[], params: ParamSource): T[] {
  const skip = Number(params.get('skip') ?? 0);
  const limit = Math.min(Number(params.get('limit') ?? 50), 500);
  return lista.slice(skip, skip + limit);
}

function filterByParams<T>(lista: T[], params: ParamSource, predicate: (item: T) => boolean): T[] {
  return paginate(
    lista.filter(predicate),
    params,
  );
}

function matchId(path: string, prefix: string): number | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  return Number(rest);
}

function resolveUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return MOCK_USUARIOS.find((u) => token.includes(`.${u.id}.`) || token.includes(`.${u.id}`)) ?? null;
}

function userRol(): string | null {
  return resolveUser(state.accessToken ? `Bearer ${state.accessToken}` : null)?.nombre_rol ?? null;
}

function ok<T>(body: T): Observable<HttpResponse<T>> {
  return of(new HttpResponse({ status: 200, body }));
}

function noContent(): Observable<HttpResponse<null>> {
  return of(new HttpResponse({ status: 204, body: null }));
}

function fail(
  status: number,
  error_code: string,
  message: string,
  details?: unknown,
): Observable<never> {
  const body: ApiErrorBody = {
    error_code,
    message,
    details: (details ?? null) as Record<string, unknown> | null,
  };
  return throwError(
    () =>
      new HttpErrorResponse({
        status,
        error: body,
        url: `mock://${error_code}`,
        statusText: message,
      }),
  );
}
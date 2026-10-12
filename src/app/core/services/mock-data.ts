/**
 * Datos sintéticos del Almacén Industrial "XYZ".
 *
 * Reflejan el diseño de `proyecto.md`: 5 pasillos, 50 productos, 150
 * ubicaciones, códigos QR, inventario inicial e incidencias.
 *
 * ⚠️ SOLO DESARROLLO. Este módulo nunca entra en el bundle de producción
 * (el interceptor se registra únicamente si `environment.useMockApi`).
 * Las formas de los objetos son EXACTAMENTE las de los DTOs del backend,
 * de modo que el resto de la app no puede notar la diferencia.
 */

import type { Usuario } from '../models/auth.model';
import type { BusquedaHistorial, BusquedaIniciada } from '../models/busqueda.model';
import type { Categoria } from '../models/categoria.model';
import type { Incidencia, IncidenciaTipo } from '../models/incidencia.model';
import type { AlertaStock, StockProducto } from '../models/inventario.model';
import type {
  Comparativa,
  DashboardResumen,
  ResumenIncidencias,
  ResumenMovimientos,
  TiempoPromedio,
} from '../models/metrica.model';
import type { Movimiento, MovimientoTipo } from '../models/movimiento.model';
import type { Producto } from '../models/producto.model';
import type { Ubicacion } from '../models/ubicacion.model';

// ── Determinismo ─────────────────────────────────────────────────────────
// Sin esto cada recarga generaría stock y fechas distintas y los tests
// serían intermitentes.
let seed = 20240115;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

const PASILLOS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
const ESTANTES = ['A', 'B', 'C', 'D'] as const;
const NIVELES = ['01', '02', '03', '04'] as const;

/** Fecha fija "ahora" para que las fechas del mock sean estables. */
export const NOW = new Date('2024-10-01T09:00:00');
function iso(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ── Usuarios ────────────────────────────────────────────────────────────
export const MOCK_USUARIOS: Usuario[] = [
  {
    id: 1,
    nombre: 'Ana Torres',
    email: 'ana.torres@xyz.com',
    rol_id: 1,
    nombre_rol: 'Administrador',
    activo: true,
    fecha_creacion: '2024-01-01T00:00:00',
    ultimo_acceso: '2024-09-30T17:40:00',
  },
  {
    id: 2,
    nombre: 'Carlos Ruiz',
    email: 'carlos.ruiz@xyz.com',
    rol_id: 2,
    nombre_rol: 'Supervisor',
    activo: true,
    fecha_creacion: '2024-01-02T00:00:00',
    ultimo_acceso: '2024-09-30T16:10:00',
  },
  {
    id: 3,
    nombre: 'Luis Mendoza',
    email: 'luis.mendoza@xyz.com',
    rol_id: 3,
    nombre_rol: 'Almacenero',
    activo: true,
    fecha_creacion: '2024-01-03T00:00:00',
    ultimo_acceso: '2024-09-30T14:05:00',
  },
];

/**
 * Catálogo de categorías.
 *
 * NO existe en el backend real todavía (PET-1 en DECISIONS.md). Está aquí
 * para que el mock permita desarrollar y demostrar el formulario de producto
 * con nombres en lugar de ids sueltos.
 */
export const MOCK_CATEGORIAS: Categoria[] = [
  { id: 1, nombre: 'Fijación y tornillería', descripcion: 'Tornillos, tuercas, arandelas y remaches.', activo: true },
  { id: 2, nombre: 'Seguridad industrial', descripcion: 'EPP: guantes, gafas, cascos y calzado.', activo: true },
  { id: 3, nombre: 'Embalaje', descripcion: 'Cajas, film, cinta y material de packing.', activo: true },
  { id: 4, nombre: 'Pintura y acabados', descripcion: 'Pinturas, disolventes y herramientas de aplicación.', activo: true },
  { id: 5, nombre: 'Limpieza e higiene', descripcion: 'Productos de limpieza y aseo del almacén.', activo: true },
  { id: 6, nombre: 'Mantenimiento', descripcion: 'Repuestos de equipos y motor.', activo: true },
  { id: 7, nombre: 'Ferretería', descripcion: 'Herramienta manual y consumibles.', activo: true },
  { id: 8, nombre: 'Otros', descripcion: 'Sin clasificar.', activo: true },
];

// ── Ubicaciones: 5 pasillos x 4 estantes x 4 niveles = 80 ───────────────
function buildUbicaciones(): Ubicacion[] {
  const out: Ubicacion[] = [];
  let id = 1;
  for (const pasillo of PASILLOS) {
    for (const estante of ESTANTES) {
      for (const nivel of NIVELES) {
        const codigo = `${pasillo}-${estante}-${nivel}`;
        out.push({
          id: id++,
          almacen_id: 1,
          pasillo,
          estante,
          nivel,
          codigo_ubicacion: codigo,
          codigo_qr: `QR-${codigo}`,
          coordenada_x: String(randInt(5, 95)),
          coordenada_y: String(randInt(5, 95)),
          activo: true,
          created_at: iso(new Date('2024-01-05T08:00:00')),
        });
      }
    }
  }
  return out;
}

export const MOCK_UBICACIONES: Ubicacion[] = buildUbicaciones();

// ── Productos: 50 ───────────────────────────────────────────────────────
const NOMBRES_BASE: readonly { nombre: string; unidad: string; categoria: number }[] = [
  { nombre: 'Tornillos 1/4"', unidad: 'pieza', categoria: 1 },
  { nombre: 'Tornillos 3/8"', unidad: 'pieza', categoria: 1 },
  { nombre: 'Tornillos 1/2"', unidad: 'pieza', categoria: 1 },
  { nombre: 'Tuercas 1/4"', unidad: 'pieza', categoria: 1 },
  { nombre: 'Tuercas 3/8"', unidad: 'pieza', categoria: 1 },
  { nombre: 'Arandelas planas', unidad: 'pieza', categoria: 1 },
  { nombre: 'Arandelas de grower', unidad: 'pieza', categoria: 1 },
  { nombre: 'Guantes de seguridad', unidad: 'par', categoria: 2 },
  { nombre: 'Guantes de corte', unidad: 'par', categoria: 2 },
  { nombre: 'Gafas de protección', unidad: 'unidad', categoria: 2 },
  { nombre: 'Mascarilla P100', unidad: 'unidad', categoria: 2 },
  { nombre: 'Casco de seguridad', unidad: 'unidad', categoria: 2 },
  { nombre: 'Botas de jebe', unidad: 'par', categoria: 2 },
  { nombre: 'Chaleco reflectante', unidad: 'unidad', categoria: 2 },
  { nombre: 'Cinta industrial', unidad: 'rollo', categoria: 3 },
  { nombre: 'Cinta de empaque', unidad: 'rollo', categoria: 3 },
  { nombre: 'Film stretch', unidad: 'rollo', categoria: 3 },
  { nombre: 'Caja de cartón grande', unidad: 'unidad', categoria: 3 },
  { nombre: 'Caja de cartón mediana', unidad: 'unidad', categoria: 3 },
  { nombre: 'Caja de cartón pequeña', unidad: 'unidad', categoria: 3 },
  { nombre: 'Bolsa de polietileno', unidad: 'paquete', categoria: 3 },
  { nombre: 'Etiqueta térmica', unidad: 'paquete', categoria: 3 },
  { nombre: 'Palet de madera', unidad: 'unidad', categoria: 3 },
  { nombre: 'Brush de pintura', unidad: 'unidad', categoria: 4 },
  { nombre: 'Rodillo de pintura', unidad: 'unidad', categoria: 4 },
  { nombre: 'Lija número 120', unidad: 'unidad', categoria: 4 },
  { nombre: 'Lija número 400', unidad: 'unidad', categoria: 4 },
  { nombre: 'Espátula metálica', unidad: 'unidad', categoria: 4 },
  { nombre: 'Desengrasante industrial', unidad: 'litro', categoria: 4 },
  { nombre: 'Pintura epóxica', unidad: 'litro', categoria: 4 },
  { nombre: 'Brocha de cerdas', unidad: 'unidad', categoria: 4 },
  { nombre: 'Escoba industrial', unidad: 'unidad', categoria: 5 },
  { nombre: 'Recogedor industrial', unidad: 'unidad', categoria: 5 },
  { nombre: 'Paño de microfibra', unidad: 'unidad', categoria: 5 },
  { nombre: 'Detergente industrial', unidad: 'litro', categoria: 5 },
  { nombre: 'Papel higiénico industrial', unidad: 'paquete', categoria: 5 },
  { nombre: 'Jabón de manos', unidad: 'litro', categoria: 5 },
  { nombre: 'Contenedor de residuos', unidad: 'unidad', categoria: 5 },
  { nombre: 'Batería de forklift', unidad: 'unidad', categoria: 6 },
  { nombre: 'Filtro de aire', unidad: 'unidad', categoria: 6 },
  { nombre: 'Filtro de aceite', unidad: 'unidad', categoria: 6 },
  { nombre: 'Bujía de encendido', unidad: 'unidad', categoria: 6 },
  { nombre: 'Neumático 18x7', unidad: 'unidad', categoria: 6 },
  { nombre: 'Correa de transmisión', unidad: 'unidad', categoria: 6 },
  { nombre: 'Rodamiento 6204', unidad: 'unidad', categoria: 6 },
  { nombre: 'Rueda poliuretano', unidad: 'unidad', categoria: 6 },
  { nombre: 'Sensor de proximidad', unidad: 'unidad', categoria: 6 },
  { nombre: 'Alarma de reversing', unidad: 'unidad', categoria: 6 },
  { nombre: 'Cargador 48V', unidad: 'unidad', categoria: 6 },
];

const PREFIJOS = ['T', 'T', 'G', 'C', 'P', 'L', 'R', 'E'] as const;

export const MOCK_PRODUCTOS: Producto[] = NOMBRES_BASE.map((base, i) => {
  const prefijo = PREFIJOS[i % PREFIJOS.length]!;
  return {
    id: i + 1,
    codigo: `${prefijo}${String(i + 1).padStart(3, '0')}`,
    nombre: base.nombre,
    descripcion: `Producto de ejemplo del Almacén XYZ, categoría ${base.categoria}.`,
    categoria_id: base.categoria,
    unidad_medida: base.unidad,
    stock_minimo: pick([20, 25, 30, 40, 50, 100]),
    foto_url: null,
    activo: i % 17 !== 16, // unos pocos dados de baja
    fecha_creacion: iso(new Date('2024-01-10T08:00:00')),
    fecha_actualizacion: iso(new Date('2024-06-15T10:30:00')),
  };
});

// ── Inventario: cada producto en 1-3 ubicaciones ────────────────────────
type Existencia = { producto_id: number; ubicacion_id: number; cantidad: number };

export const MOCK_EXISTENCIAS: Existencia[] = (() => {
  const out: Existencia[] = [];
  let cursor = 0;
  for (const producto of MOCK_PRODUCTOS) {
    const n = randInt(1, 3);
    for (let k = 0; k < n; k++) {
      const ubicacion = MOCK_UBICACIONES[cursor % MOCK_UBICACIONES.length]!;
      cursor += randInt(1, 3);
      out.push({
        producto_id: producto.id,
        ubicacion_id: ubicacion.id,
        cantidad: randInt(10, 500),
      });
    }
  }
  return out;
})();

function stockDe(productoId: number): Existencia[] {
  return MOCK_EXISTENCIAS.filter((e) => e.producto_id === productoId);
}

export function stockTotal(productoId: number): number {
  return stockDe(productoId).reduce((acc, e) => acc + e.cantidad, 0);
}

export function stockProducto(productoId: number): StockProducto | null {
  const p = MOCK_PRODUCTOS.find((x) => x.id === productoId);
  if (!p) return null;
  const distribucion = stockDe(productoId).map((e) => {
    const u = MOCK_UBICACIONES.find((x) => x.id === e.ubicacion_id)!;
    return {
      ubicacion_id: u.id,
      codigo_ubicacion: u.codigo_ubicacion,
      pasillo: u.pasillo,
      estante: u.estante,
      nivel: u.nivel,
      cantidad: e.cantidad,
    };
  });
  const total = distribucion.reduce((a, d) => a + d.cantidad, 0);
  return {
    producto_id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    unidad_medida: p.unidad_medida,
    stock_minimo: p.stock_minimo,
    stock_total: total,
    requiere_alerta: total < p.stock_minimo,
    distribucion,
  };
}

export function alertasStock(): AlertaStock[] {
  return MOCK_PRODUCTOS.map((p) => ({ p, total: stockTotal(p.id) }))
    .filter(({ p, total }) => total < p.stock_minimo)
    .map(({ p, total }) => ({
      producto_id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      unidad_medida: p.unidad_medida,
      stock_total: total,
      stock_minimo: p.stock_minimo,
      faltante: p.stock_minimo - total,
    }))
    .sort((a, b) => b.faltante - a.faltante);
}

// ── Movimientos ─────────────────────────────────────────────────────────
const REFERENCIAS = ['OC-2024-001', 'PEDIDO-001', 'OC-2024-014', 'PEDIDO-118', 'AJUSTE-07'];

export const MOCK_MOVIMIENTOS: Movimiento[] = Array.from({ length: 45 }, (_, i) => {
  const tipo: MovimientoTipo = pick(['ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE'] as const);
  const producto = pick(MOCK_PRODUCTOS);
  const origen = pick(MOCK_UBICACIONES);
  const destino = pick(MOCK_UBICACIONES);
  const fecha = new Date(NOW.getTime() - randInt(0, 45) * 86_400_000 - randInt(0, 86_399) * 1000);
  return {
    id: i + 1,
    tipo,
    producto_id: producto.id,
    cantidad: randInt(5, 200),
    ubicacion_origen_id: tipo === 'ENTRADA' ? null : origen.id,
    ubicacion_destino_id: tipo === 'SALIDA' ? null : destino.id,
    usuario_id: randInt(1, 3),
    fecha: iso(fecha),
    referencia: pick(REFERENCIAS),
    observaciones: `Movimiento simulado de tipo ${tipo}`,
  };
}).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

// ── Incidencias ─────────────────────────────────────────────────────────
const DESCRIPCIONES: Record<IncidenciaTipo, readonly string[]> = {
  MAL_UBICADO: [
    'Producto encontrado en una ubicación distinta a la indicada por el sistema.',
    'Tornillos encontrados en el estante C cuando deberían estar en el B.',
  ],
  FALTANTE: ['El estante aparece vacío pero el sistema reporta existencias.', 'Faltan 12 unidades según conteo cíclico.'],
  DANADO: ['Embalaje deformado por humedad.', 'Producto con óxido; se descartó.'],
  OTRO: ['Etiqueta de código QR ilegible.', 'Estante ocupado por material ajeno.'],
};

export const MOCK_INCIDENCIAS: Incidencia[] = Array.from({ length: 12 }, (_, i) => {
  const tipo = pick(['MAL_UBICADO', 'FALTANTE', 'DANADO', 'OTRO'] as const);
  const resuelta = i % 9 !== 0; // ~1 abierta, como en el ejemplo de la API
  const fecha = new Date(NOW.getTime() - randInt(0, 40) * 86_400_000);
  return {
    id: i + 1,
    tipo,
    producto_id: pick(MOCK_PRODUCTOS).id,
    ubicacion_id: pick(MOCK_UBICACIONES).id,
    usuario_id: randInt(1, 3),
    fecha: iso(fecha),
    descripcion: pick(DESCRIPCIONES[tipo]),
    resuelta,
    fecha_resolucion: resuelta ? iso(new Date(fecha.getTime() + 86_400_000)) : null,
  };
}).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

// ── Búsquedas ───────────────────────────────────────────────────────────
// El proyecto demuestra mejora de ~8 min → ~1.5 min. Sembramos el historial
// con esa curva: julio lento, septiembre rápido.
export const MOCK_BUSQUEDAS: BusquedaHistorial[] = (() => {
  const out: BusquedaHistorial[] = [];
  let id = 1;
  for (let mes = 0; mes < 3; mes++) {
    const cantidad = [35, 30, 18][mes]!;
    // Promedio del mes: jul ~500 s, ago ~300 s, sep ~82 s
    const promedio = [500, 300, 82][mes]!;
    for (let k = 0; k < cantidad; k++) {
      const producto = pick(MOCK_PRODUCTOS);
      const fecha = new Date(2024, 6 + mes, randInt(1, 28), randInt(6, 19), randInt(0, 59));
      const exito = rand() > 0.08;
      out.push({
        id: id++,
        termino_busqueda: producto.nombre,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        exito,
        tiempo_busqueda_segundos: Math.round(promedio * (0.6 + rand() * 0.8)),
        fecha: iso(fecha),
      });
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
})();

export function busquedaIniciada(producto: Producto | null, busquedaId: number): BusquedaIniciada {
  const dist = producto ? (stockProducto(producto.id)?.distribucion ?? []) : [];
  return {
    busqueda_id: busquedaId,
    producto,
    stock_total: dist.reduce((a, d) => a + d.cantidad, 0),
    ubicaciones: dist.map((d) => ({
      ubicacion_id: d.ubicacion_id,
      codigo_ubicacion: d.codigo_ubicacion,
      pasillo: d.pasillo,
      estante: d.estante,
      nivel: d.nivel,
      cantidad: d.cantidad,
    })),
  };
}

// ── Métricas ────────────────────────────────────────────────────────────
export function dashboardResumen(): DashboardResumen {
  const alertas = alertasStock().length;
  const abiertas = MOCK_INCIDENCIAS.filter((i) => !i.resuelta).length;
  const sept = MOCK_BUSQUEDAS.filter((b) => b.fecha.startsWith('2024-09'));
  const promedio =
    sept.length > 0 ? sept.reduce((a, b) => a + (b.tiempo_busqueda_segundos ?? 0), 0) / sept.length : 0;

  return {
    total_productos: MOCK_PRODUCTOS.length,
    total_ubicaciones: MOCK_UBICACIONES.length,
    productos_stock_bajo: alertas,
    total_incidencias_abiertas: abiertas,
    tiempo_promedio_busqueda_segundos: Number(promedio.toFixed(1)),
    tiempo_promedio_busqueda_minutos: Number((promedio / 60).toFixed(2)),
    total_busquedas: MOCK_BUSQUEDAS.length,
  };
}

export function tiempoPromedio(desde?: string, hasta?: string): TiempoPromedio {
  let lista = MOCK_BUSQUEDAS;
  if (desde) lista = lista.filter((b) => b.fecha >= desde);
  if (hasta) lista = lista.filter((b) => b.fecha <= `${hasta} 23:59:59`);
  const conTiempo = lista.filter((b) => b.tiempo_busqueda_segundos !== null);
  const promedio = conTiempo.length
    ? conTiempo.reduce((a, b) => a + b.tiempo_busqueda_segundos!, 0) / conTiempo.length
    : null;
  const exitosas = lista.filter((b) => b.exito).length;
  return {
    desde: desde ?? null,
    hasta: hasta ?? null,
    total_busquedas: lista.length,
    // El backend devuelve `null` (no 0) cuando el rango está vacío.
    promedio_segundos: promedio === null ? null : Number(promedio.toFixed(1)),
    promedio_minutos: promedio === null ? null : Number((promedio / 60).toFixed(2)),
    exitosas,
    fallidas: lista.length - exitosas,
  };
}

export function comparativa(
  desdeAnterior: string,
  hastaAnterior: string,
  desdeActual: string,
  hastaActual: string,
): Comparativa {
  const previo = tiempoPromedio(desdeAnterior, hastaAnterior);
  const actual = tiempoPromedio(desdeActual, hastaActual);

  // Igual que el backend: si un periodo no tiene datos, la mejora es `null`.
  const comparable =
    previo.promedio_segundos !== null && actual.promedio_segundos !== null;

  const mejoraSegundos = comparable
    ? Number((previo.promedio_segundos! - actual.promedio_segundos!).toFixed(1))
    : null;
  const mejoraPorcentaje =
    comparable && previo.promedio_segundos
      ? Number(((mejoraSegundos! / previo.promedio_segundos!) * 100).toFixed(2))
      : null;

  return {
    periodo_actual: {
      desde: desdeActual,
      hasta: hastaActual,
      total_busquedas: actual.total_busquedas,
      promedio_segundos: actual.promedio_segundos,
    },
    periodo_anterior: {
      desde: desdeAnterior,
      hasta: hastaAnterior,
      total_busquedas: previo.total_busquedas,
      promedio_segundos: previo.promedio_segundos,
    },
    mejora_segundos: mejoraSegundos,
    mejora_porcentaje: mejoraPorcentaje,
  };
}

export function resumenIncidencias(): ResumenIncidencias {
  const por_tipo: Partial<Record<string, number>> = {};
  for (const i of MOCK_INCIDENCIAS) {
    por_tipo[i.tipo] = (por_tipo[i.tipo] ?? 0) + 1;
  }
  return {
    total: MOCK_INCIDENCIAS.length,
    abiertas: MOCK_INCIDENCIAS.filter((i) => !i.resuelta).length,
    resueltas: MOCK_INCIDENCIAS.filter((i) => i.resuelta).length,
    por_tipo,
  };
}

export function resumenMovimientos(): ResumenMovimientos {
  const por_tipo: Partial<Record<string, number>> = {};
  let piezas = 0;
  for (const m of MOCK_MOVIMIENTOS) {
    por_tipo[m.tipo] = (por_tipo[m.tipo] ?? 0) + 1;
    piezas += m.cantidad;
  }
  return { total: MOCK_MOVIMIENTOS.length, por_tipo, total_piezas_movidas: piezas };
}

// ── Búsqueda de productos por nombre o código ──────────────────────────
export function buscarProductos(termino: string): Producto[] {
  const t = termino.trim().toLowerCase();
  if (t.length === 0) return [];
  return MOCK_PRODUCTOS.filter(
    (p) => p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t),
  ).slice(0, 20);
}
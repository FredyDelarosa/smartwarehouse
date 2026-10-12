/**
 * Búsquedas de producto — el flujo principal del trabajador.
 * Espejo de: POST /busquedas/iniciar, POST /busquedas/{id}/finalizar,
 *             GET /busquedas/historial
 */

import type { Producto } from './producto.model';

/** Ubicación donde hay existencias del producto buscado. */
export type UbicacionConCantidad = {
  ubicacion_id: number;
  codigo_ubicacion: string;
  pasillo: string;
  estante: string;
  nivel: string;
  cantidad: number;
};

/**
 * Respuesta de POST /busquedas/iniciar.
 *
 * IMPORTANTE: `producto` puede venir `null` si el texto no coincide con nada.
 * El frontend debe tratarlo como "sin coincidencias", no como error.
 */
export type BusquedaIniciada = {
  busqueda_id: number;
  producto: Producto | null;
  stock_total: number;
  ubicaciones: UbicacionConCantidad[];
};

/** Cuerpo de POST /busquedas/iniciar */
export type IniciarBusquedaRequest = {
  termino_busqueda: string;
  producto_id?: number | null;
};

/** Cuerpo de POST /busquedas/{id}/finalizar */
export type FinalizarBusquedaRequest = {
  ubicacion_encontrada_id: number;
  observaciones?: string;
};

/** Respuesta de POST /busquedas/{id}/finalizar */
export type BusquedaFinalizada = {
  exito: boolean;
  tiempo_busqueda_segundos: number;
};

/**
 * Fila **cruda** de `GET /busquedas/historial`, tal como la devuelve el
 * servidor.
 *
 * OJO: el backend NO manda `busqueda_id` ni `producto_nombre`, y usa
 * `fecha_hora_inicio` / `fecha_hora_fin` en vez de un `fecha` único. Es la
 * fila cruda de la tabla `busquedas`, no un DTO pensado para la UI.
 * `normalizarBusqueda()` la convierte al modelo de vista.
 */
export type BusquedaHistorialApi = {
  id: number;
  usuario_id: number | null;
  producto_id: number | null;
  termino_busqueda: string;
  /**
   * El backend añadió el campo (OBS-6, 2026-10-12) con el JOIN a `productos`,
   * pero hoy llega siempre `null`: el repositorio desempaqueta el nombre y no
   * lo adjunta a la entidad. Opcional a propósito, para que cuando empiece a
   * llegar de verdad la UI lo use sin tocar nada.
   */
  producto_nombre?: string | null;
  fecha_hora_inicio: string;
  fecha_hora_fin: string | null;
  tiempo_busqueda_segundos: number | null;
  ubicacion_encontrada_id: number | null;
  exito: boolean;
  observaciones: string | null;
};

/**
 * Fila de historial ya normalizada para la tabla.
 *
 * Se separa del DTO porque el servidor no incluye `producto_nombre`: haría
 * falta un JOIN que hoy no existe. La UI cae en el término que escribió el
 * usuario, que además es lo que el trabajador reconoce.
 */
export type BusquedaHistorial = {
  id: number;
  producto_id: number | null;
  termino_busqueda: string;
  /** null hasta que el backend haga el JOIN con `producto`. */
  producto_nombre: string | null;
  exito: boolean;
  tiempo_busqueda_segundos: number | null;
  /** Instante de cierre si la hubo; si no, de inicio. */
  fecha: string;
};

/** Convierte la fila cruda del servidor al modelo de vista. */
export function normalizarBusqueda(fila: BusquedaHistorialApi): BusquedaHistorial {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    termino_busqueda: fila.termino_busqueda,
    // Si algún día el JOIN empieza a devolver el nombre, se usa sin más
    // cambios. Mientras llega `null`, la tabla cae en el término buscado.
    producto_nombre: fila.producto_nombre ?? null,
    exito: fila.exito,
    tiempo_busqueda_segundos: fila.tiempo_busqueda_segundos,
    fecha: fila.fecha_hora_fin ?? fila.fecha_hora_inicio,
  };
}
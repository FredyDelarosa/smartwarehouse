/**
 * Movimientos de inventario.
 * Espejo de: POST /movimientos/entrada|salida|traslado, GET /movimientos/
 */

export type MovimientoTipo = 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'AJUSTE';

export const MOVIMIENTO_TIPOS: readonly MovimientoTipo[] = [
  'ENTRADA',
  'SALIDA',
  'TRASLADO',
  'AJUSTE',
] as const;

export type Movimiento = {
  id: number;
  tipo: MovimientoTipo;
  producto_id: number;
  cantidad: number;
  ubicacion_origen_id: number | null;
  ubicacion_destino_id: number | null;
  usuario_id: number;
  fecha: string;
  referencia: string | null;
  observaciones: string | null;
};

/** Base común de los tres formularios de movimiento. */
export type MovimientoBase = {
  producto_id: number;
  cantidad: number;
  referencia?: string | null;
  observaciones?: string | null;
};

/** POST /movimientos/entrada */
export type EntradaRequest = MovimientoBase & {
  tipo: 'ENTRADA';
  ubicacion_destino_id: number;
};

/** POST /movimientos/salida */
export type SalidaRequest = MovimientoBase & {
  tipo: 'SALIDA';
  ubicacion_origen_id: number;
};

/** POST /movimientos/traslado */
export type TrasladoRequest = MovimientoBase & {
  tipo: 'TRASLADO';
  ubicacion_origen_id: number;
  ubicacion_destino_id: number;
};

export type MovimientoRequest = EntradaRequest | SalidaRequest | TrasladoRequest;

export type MovimientoQuery = {
  producto_id?: number | null;
  ubicacion_id?: number | null;
  usuario_id?: number | null;
  tipo?: MovimientoTipo | null;
  skip?: number;
  limit?: number;
};
/**
 * Inventario.
 * Espejo de: GET /inventario/producto/{id}, GET /inventario/alertas
 */

/** Cantidad de un producto repartida en una ubicación concreta. */
export type DistribucionStock = {
  ubicacion_id: number;
  codigo_ubicacion: string;
  pasillo: string;
  estante: string;
  nivel: string;
  cantidad: number;
};

/** Stock consolidado de un producto en todas sus ubicaciones. */
export type StockProducto = {
  producto_id: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  stock_minimo: number;
  stock_total: number;
  /** true cuando stock_total < stock_minimo. */
  requiere_alerta: boolean;
  distribucion: DistribucionStock[];
};

/** Fila de GET /inventario/alertas */
export type AlertaStock = {
  producto_id: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  stock_total: number;
  stock_minimo: number;
  /** stock_minimo - stock_total. Siempre positivo en una alerta. */
  faltante: number;
};
/**
 * Carga inicial: varias existencias en una llamada (POST /inventario/carga-inicial).
 *
 * Devuelve 201 aunque alguna línea falle, y el detalle va línea a línea: es
 * normal que un producto esté dado de baja y eso no debe impedir cargar los
 * otros doscientos.
 */
export type LineaCargaInicial = {
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
};

export type CargaInicialRequest = {
  lineas: LineaCargaInicial[];
  referencia?: string | null;
  observaciones?: string | null;
};

export type LineaCargaResultado = {
  indice: number;
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
  movimiento_id: number | null;
  ok: boolean;
  error: string | null;
};

export type CargaInicialResultado = {
  total_lineas: number;
  registradas: number;
  fallidas: number;
  movimientos: LineaCargaResultado[];
};

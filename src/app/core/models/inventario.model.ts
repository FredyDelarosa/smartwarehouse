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
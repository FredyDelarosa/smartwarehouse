/**
 * Productos.
 * Espejo de: /productos, /productos/buscar, /productos/{id}
 */

/** Entidad devuelta por el backend. */
export type Producto = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number | null;
  unidad_medida: string;
  stock_minimo: number;
  foto_url: string | null;
  activo: boolean;
  fecha_creacion: string | null;
  fecha_actualizacion: string | null;
};

/** Cuerpo de POST /productos (crear). */
export type ProductoCreate = {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  categoria_id?: number | null;
  unidad_medida: string;
  stock_minimo: number;
  foto_url?: string | null;
  activo: boolean;
};

/**
 * Cuerpo de PATCH /productos/{id} (actualizar parcial).
 * Todos los campos opcionales: el backend solo aplica lo enviado.
 */
export type ProductoUpdate = Partial<ProductoCreate>;

/** Query params de GET /productos/ */
export type ProductoQuery = {
  skip?: number;
  limit?: number;
  categoria_id?: number | null;
  solo_activos?: boolean;
};

/** Query params de GET /productos/buscar */
export type ProductoSearchQuery = {
  termino: string;
  limit?: number;
};

/**
 * El backend devuelve un array plano para listados, sin envoltorio ni total.
 * Para paginar de verdad necesitamos un size extra: pedimos limit+1 y
 * usamos la presencia del elemento extra como "hay más".
 * Ver core/utils/paginacion.ts.
 */
export type ProductoListado = Producto[];
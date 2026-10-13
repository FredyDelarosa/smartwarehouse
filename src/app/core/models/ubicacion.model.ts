/**
 * Ubicaciones.
 * Espejo de: /ubicaciones, /ubicaciones/qr/{codigo_qr}, /ubicaciones/almacen/{id}
 */

export type Ubicacion = {
  id: number;
  almacen_id: number;
  pasillo: string;
  estante: string;
  nivel: string;
  /** Ej: "P3-A-01". Compuesto de pasillo-estante-nivel. */
  codigo_ubicacion: string;
  /** Ej: "QR-P3-A-01". Es lo que se escanea con la cámara. */
  codigo_qr: string;
  /** Vienen como string en el backend aunque sean numéricos. */
  coordenada_x: string | null;
  coordenada_y: string | null;
  activo: boolean;
  created_at: string | null;
};

export type UbicacionCreate = {
  almacen_id: number;
  pasillo: string;
  estante: string;
  nivel: string;
  codigo_ubicacion: string;
  codigo_qr: string;
  coordenada_x?: string | null;
  coordenada_y?: string | null;
  activo: boolean;
};

export type UbicacionUpdate = Partial<UbicacionCreate>;

export type UbicacionQuery = {
  almacen_id?: number | null;
  solo_activas?: boolean;
  skip?: number;
  limit?: number;
};

/** Producto almacenado en una ubicación. Usado por /ubicaciones/qr/{codigo}. */
export type ProductoEnUbicacion = {
  producto_id: number;
  codigo: string;
  nombre: string;
  cantidad: number;
};

/** Respuesta de GET /ubicaciones/qr/{codigo_qr} */
export type UbicacionConProductos = {
  ubicacion: Ubicacion;
  productos: ProductoEnUbicacion[];
};

/**
 * Ubicación con su stock, para el listado.
 *
 * ⚠️ **PENDIENTE DE BACKEND**: hoy `GET /ubicaciones/` **no** incluye productos
 * ni existencias. Para ver el catálogo haría falta pedir `/ubicaciones/qr/{c}`
 * una vez por cada fila, y con 20 filas por página son 20 peticiones idénticas
 * en bucle; con 150 ubicaciones, 150. No es un problema de rendimiento, es una
 * ausencia de endpoint.
 *
 * Contrato que debe cumplir `GET /inventario/ubicaciones`:
 *
 * ```typescript
 * type UbicacionStock = {
 *   ubicacion_id: number;
 *   codigo_ubicacion: string;
 *   pasillo: string;
 *   estante: string;
 *   nivel: string;
 *   productos: { producto_id: number; codigo: string; nombre: string; cantidad: number }[];
 *   total_unidades: number;
 * };
 * ```
 *
 * Se trae `codigo` **y** `nombre`: el código es lo que se lee en la etiqueta
 * del estante, y el nombre es lo que entiende el trabajador. Con solo el id no
 * se puede mostrar nada legible.
 *
 * Mientras el endpoint no exista, `stockPorUbicacion` queda vacío y la columna
 * muestra "—". Ver DECISIONS.md §PET-3.
 */
export type UbicacionStock = {
  ubicacion_id: number;
  codigo_ubicacion: string;
  pasillo: string;
  estante: string;
  nivel: string;
  productos: ProductoEnUbicacion[];
  total_unidades: number;
};
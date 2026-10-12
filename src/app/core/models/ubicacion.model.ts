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
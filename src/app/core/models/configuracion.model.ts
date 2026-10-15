/**
 * DTOs de la configuración del almacén por cuestionario (PET-4).
 * Espejo de: POST /configuracion/previsualizar, POST /configuracion/generar,
 *             GET  /configuracion/almacen
 *
 * ## El estante es UNA letra
 *
 * `estantes` va de 1 a 26 porque el código de ubicación es `P{pasillo}-{letra}-
 * {nivel}` y el backend lo valida con el mismo value object que usa para las
 * ubicaciones creadas a mano. No es una decisión de esta pantalla: el formato
 * del QR ya estaba impreso en el almacén original. Cambiarlo aquí solo haría
 * que el servidor devolviera un 422.
 */

/** Una letra de estante: A..Z. */
export type LetraEstante = string;

export type PasilloConfig = {
  nombre: string;
  estantes: number;
  /** Letras que existen pero no admiten stock (obstruidas, en reforma). */
  estantes_fuera_servicio: LetraEstante[];
};

export type NivelConfig = {
  nombre: string;
};

export type ConfigAlmacenRequest = {
  pasillos: PasilloConfig[];
  niveles: NivelConfig[];
};

export type UbicacionPrevisualizada = {
  codigo_ubicacion: string;
  codigo_qr: string;
  pasillo: string;
  estante: string;
  nivel: string;
  activo: boolean;
};

/** Lo que se crearía, sin escribir nada. */
export type Previsualizacion = {
  total: number;
  activas: number;
  fuera_servicio: number;
  por_pasillo: Record<string, number>;
  total_pasillos: number;
  total_estantes: number;
  total_niveles: number;
  muestra: UbicacionPrevisualizada[];
  advertencias: string[];
  ya_existentes: number;
};

export type GeneracionResult = {
  creadas: number;
  omitidas: number;
  fuera_servicio: number;
  muestra: UbicacionPrevisualizada[];
};

export type ResumenAlmacen = {
  /** Nombre del almacén: va en el encabezado de la hoja impresa. */
  nombre: string;
  total_ubicaciones: number;
  activas: number;
  fuera_servicio: number;
  pasillos: number;
  niveles: number;
  configurado: boolean;
};

/** A..Z. Es el rango real que acepta el backend. */
export const LETRAS_ESTANTE: readonly LetraEstante[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

export const MAX_ESTANTES = 26;
export const MAX_PASILLOS = 99;
export const MAX_NIVELES = 99;
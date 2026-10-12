/**
 * Categorías de producto.
 *
 * ⚠️ PENDIENTE DE BACKEND: la tabla `categorias` existe y `/categorias` está
 * registrado, pero `GET /categorias/` responde **500** (el use case llama
 * `repo.list(skip=…, limit=…, solo_activas=…)` y la implementación no acepta
 * argumentos). Además la tabla **no tiene columna `activo`**, aunque el
 * endpoint acepta `solo_activas` y el DTO lo declara.
 *
 * Ver DECISIONS.md §"PET-1 — Categorías".
 *
 * Por eso `activo` es opcional: hasta que se decida si se añade la columna o
 * se quita el parámetro, el frontend no puede asumir que llegue.
 */
export type Categoria = {
  id: number;
  nombre: string;
  descripcion: string | null;
  /** El servidor hoy no lo envía; se trata como activa si viene ausente. */
  activo?: boolean;
};

/** Categoría con la información calculada para pintar en un `<select>`. */
export type CategoriaOpcion = {
  value: number;
  label: string;
  descripcion: string | null;
  /** true si el backend no expone el catálogo (ver más abajo). */
  provisional: boolean;
};

/**
 * Etiqueta de último recurso cuando el servidor no manda el catálogo.
 *
 * Nunca se muestra un número pelado: aunque no haya nombres, el usuario ve
 * "Categoría #5 (sin catálogo)" y entiende que falta información, no que
 * "5" sea una categoría llamada 5.
 */
export function etiquetaProvisional(id: number): string {
  return `Categoría #${id} (sin catálogo)`;
}
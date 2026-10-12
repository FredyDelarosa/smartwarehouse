import { type Pagina, type PageParams } from '../models/paginacion.model';

/**
 * Paginación sobre listados que el backend devuelve como array plano.
 *
 * El backend NO expone `total`, así que pedimos `limit + 1`: si llega el
 * elemento extra, sabemos que hay página siguiente (y lo descartamos).
 *
 * Cuando el backend crezca y devuelva `{items,total}`, reimplementa
 * `normalizarPagina` y nada más cambia en la app.
 */
export function paginaParams(page: number, limit: number): PageParams {
  return { skip: Math.max(0, page) * limit, limit };
}

export function normalizarPagina<T>(
  respuesta: T[] | { items: T[]; total: number } | null | undefined,
  page: number,
  limit: number,
): Pagina<T> {
  // Forma futura (por si el backend cambia): total explícito.
  if (respuesta && !Array.isArray(respuesta)) {
    return {
      items: respuesta.items ?? [],
      hasNext: (page + 1) * limit < respuesta.total,
      hasPrev: page > 0,
      page,
      limit,
    };
  }

  // Forma actual: array plano. El llamante debe haber pedido limit + 1.
  const items = respuesta ?? [];
  const hasNext = items.length > limit;
  return {
    items: hasNext ? items.slice(0, limit) : items,
    hasNext,
    hasPrev: page > 0,
    page,
    limit,
  };
}

/** Rango mostrado en el pie: "1–20 de muchos". */
export function rangoTexto(pagina: Pagina<unknown>, totalConocido?: number | null): string {
  const { items, page, limit } = pagina;
  if (items.length === 0) return 'Sin resultados';
  const desde = page * limit + 1;
  const hasta = page * limit + items.length;

  if (totalConocido !== null && totalConocido !== undefined) {
    return `${desde}–${hasta} de ${totalConocido}`;
  }
  return pagina.hasNext ? `${desde}–${hasta} de más…` : `${desde}–${hasta}`;
}
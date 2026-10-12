/**
 * Helpers de paginación.
 *
 * El backend devuelve ARRAYS PLANOS para todos los listados: no incluye un
 * total ni un objeto paginado. Consecuencia práctica: nunca podemos saber
 * cuántas páginas hay en total sin un endpoint extra.
 *
 * Estrategia que usamos (ver core/utils/paginacion.ts):
 *   Pedimos `limit + 1` registros. Si llegan `limit + 1`, existe al menos una
 *   página más; lo descartamos y activamos el botón "Siguiente".
 *
 * Si algún día el backend devuelve `{items, total}`, basta con reimplementar
 * `normalizarPagina` y toda la UI sigue funcionando sin tocarla.
 */

/** Respuesta genérica de listado tras normalizar. */
export type Pagina<T> = {
  items: T[];
  /** ¿Existe una página siguiente? */
  hasNext: boolean;
  /** ¿Existe una página anterior? (skip > 0) */
  hasPrev: boolean;
  /** 0-based. */
  page: number;
  /** Tamaño de página solicitado. */
  limit: number;
};

/** Parámetros de consulta paginados. */
export type PageParams = {
  skip: number;
  limit: number;
};

/** Tamaño de página por defecto en listados densos. */
export const PAGE_SIZE = 20;

/** Máximo que acepta el backend en la mayoría de listados. */
export const MAX_PAGE_SIZE = 100;
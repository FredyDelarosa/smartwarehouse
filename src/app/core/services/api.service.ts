import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError, type ApiErrorBody } from '../models/error.model';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Valores que pueden serializarse a query params. `null`/`undefined` se omiten. */
export type QueryValue = string | number | boolean | null | undefined;

/**
 * Punto único de salida HTTP.
 *
 * - Antepone `environment.apiUrl` a toda ruta.
 * - Serializa query params omitiendo null/undefined/vacíos.
 * - Normaliza cualquier error a `ApiError`.
 *
 * NO adjunta el token aquí: eso lo hace `jwtInterceptor`. Así el refresh
 * centralizado y esta capa no se pisan.
 */
@Service()
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Observable<T> {
    return this.request<T>('POST', path, { body, query });
  }

  patch<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Observable<T> {
    return this.request<T>('PATCH', path, { body, query });
  }

  put<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Observable<T> {
    return this.request<T>('PUT', path, { body, query });
  }

  /** DELETE suele responder 204 → devuelve null. */
  delete<T = null>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.request<T>('DELETE', path, { query });
  }

  /**
   * Construye la URL absoluta a partir de una ruta relativa a `apiUrl`.
   * Útil para `httpResource`, que necesita la URL y no el `HttpClient`.
   */
  url(path: string, query?: Record<string, QueryValue>): string {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${clean}${buildQueryString(query)}`;
  }

  private request<T>(
    method: HttpMethod,
    path: string,
    options: { body?: unknown; query?: Record<string, QueryValue> } = {},
  ): Observable<T> {
    const url = this.url(path);
    const hasBody = options.body !== undefined && method !== 'GET';

    const request$ = this.http.request<T>(method, url, {
      body: options.body ?? null,
      params: toHttpParams(options.query),
      headers: hasBody ? JSON_HEADERS : undefined,
    });

    return request$.pipe(catchError((err: unknown) => throwError(() => toApiError(err, url))));
  }
}

const JSON_HEADERS = new HttpHeaders({ 'Content-Type': 'application/json' });

function toHttpParams(query?: Record<string, QueryValue>): HttpParams | undefined {
  if (!query) return undefined;
  const entries = Object.entries(query).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return undefined;
  let params = new HttpParams();
  for (const [key, value] of entries) {
    params = params.set(key, String(value));
  }
  return params;
}

function buildQueryString(query?: Record<string, QueryValue>): string {
  const params = toHttpParams(query);
  if (!params) return '';
  const str = params.toString();
  return str ? `?${str}` : '';
}

/** Convierte cualquier fallo en un `ApiError` uniforme. */
export function toApiError(err: unknown, url = ''): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof HttpErrorResponse) {
    // Fallo de red / CORS / servidor caído → status 0.
    if (err.status === 0) {
      return new ApiError({
        status: 0,
        errorCode: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor. Revisa tu conexión.',
        url,
      });
    }

    const body = err.error as Partial<ApiErrorBody> | string | null;
    if (body && typeof body === 'object' && 'message' in body) {
      const b = body as ApiErrorBody;
      return new ApiError({
        status: err.status,
        errorCode: b.error_code ?? 'UNKNOWN',
        message: b.message ?? err.statusText,
        details: b.details ?? null,
        url,
      });
    }

    return new ApiError({
      status: err.status,
      errorCode: 'HTTP_ERROR',
      message: err.statusText || 'Error en la solicitud',
      url,
    });
  }

  return new ApiError({
    status: 0,
    errorCode: 'UNKNOWN',
    message: err instanceof Error ? err.message : 'Error desconocido',
    url,
  });
}
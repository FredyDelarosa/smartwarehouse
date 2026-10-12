import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiError } from '../models/error.model';
import { AuthService } from '../services/auth.service';
import { AuthStore } from '../store/auth.store';

/** Rutas públicas: no llevan Authorization ni disparan refresh. */
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh'];

/** Margen de seguridad: renovamos 30 s antes de que caduque realmente. */
const EXPIRY_MARGIN_MS = 30_000;

/** Refresh compartido: 5 peticiones en 401 a la vez → 1 sola llamada. */
let refreshInFlight$: Observable<string> | null = null;

/**
 * Adjunta el JWT y renueva el token cuando caduca.
 *
 *  1. Si caduca pronto → refresh ANTES de enviar (evita un 401 evitable).
 *  2. Si la respuesta es 401 → refresh y reintento UNA vez.
 *  3. Si el refresh falla → limpia sesión y propaga el error.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const auth = inject(AuthService);

  if (!req.url.startsWith(environment.apiUrl) || isPublic(req.url)) {
    return next(req);
  }

  const attach = (token: string) =>
    next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));

  if (store.isExpiringSoon(EXPIRY_MARGIN_MS)) {
    return refresh(auth).pipe(switchMap(attach));
  }

  const token = store.getAccessToken();
  const outgoing = token ? attach(token) : next(req);

  return outgoing.pipe(
    catchError((err: unknown) => {
      const status = err instanceof HttpErrorResponse ? err.status : (err as ApiError)?.status;
      if (status !== 401) return throwError(() => err);

      return refresh(auth).pipe(
        switchMap(attach),
        catchError((refreshErr: unknown) => {
          store.clear();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

function isPublic(url: string): boolean {
  return PUBLIC_PATHS.some((path) => url.endsWith(path));
}

/**
 * Un único refresh en vuelo. `finalize` lo libera cuando termina, tanto si
 * tuvo éxito como si falló, para que el siguiente 401 pueda reintentar.
 */
function refresh(auth: AuthService): Observable<string> {
  if (!refreshInFlight$) {
    refreshInFlight$ = auth.refresh().pipe(finalize(() => (refreshInFlight$ = null)));
  }
  return refreshInFlight$;
}

/** Solo para tests: fuerza el próximo refresh a ser una llamada nueva. */
export function resetRefreshInFlight(): void {
  refreshInFlight$ = null;
}
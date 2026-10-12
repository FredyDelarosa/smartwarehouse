import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../models/error.model';
import { NotificationService } from '../services/notification.service';
import { AuthStore } from '../store/auth.store';

/** Códigos que el usuario puede resolver por sí mismo: no lo distraemos. */
const SILENT_CODES = new Set(['HTTP_ERROR', 'UNKNOWN']);

/**
 * Manejo centralizado de errores HTTP.
 *
 * - 401 → limpia sesión y manda a /login conservando la URL de destino.
 * - 403 → aviso "sin permisos" (el guard ya Eva occultó la acción).
 * - resto → toast con el mensaje del backend (que es más útil que un genérico).
 *
 * Los errores NUNCA se tragan: se re-lanzan para que el componente pueda
 * limpiar su estado de carga o mostrar un inline.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  const router = inject(Router);
  const store = inject(AuthStore);

  return next(req).pipe(
    catchError((err: unknown) => {
      const apiError = err instanceof ApiError ? err : null;

      if (apiError?.isUnauthorized) {
        store.clear();
        void router.navigate(['/login'], {
          queryParams: req.url.includes('/auth/') ? undefined : { returnUrl: router.url },
        });
        // No toast: la redirección ya explica qué pasó.
        return throwError(() => err);
      }

      if (apiError && !SILENT_CODES.has(apiError.errorCode)) {
        notify.apiError(apiError, `Error en ${req.url}`);
      }

      return throwError(() => err);
    }),
  );
};

/** Helper para identificar rutas de la API dentro de interceptores. */
export function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiUrl);
}
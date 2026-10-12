import {
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { ActualizacionService } from './core/services/actualizacion.service';
import { NotificationService } from './core/services/notification.service';
import { ThemeService } from './core/services/theme.service';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';

/**
 * Errores que nadie capturó (excepción en un effect, un error de render, un
 * rechazo de promesa sin catch). Sin esto el usuario ve una pantalla en
 * blanco y ni idea de qué pasó.
 */
class GlobalErrorHandler extends ErrorHandler {
  private readonly notifications = inject(NotificationService);

  override handleError(error: unknown): void {
    // Los errores internos de Angular (NG0xxx) no significan nada para el
    // usuario final: se registran, pero no se le enseña la referencia.
    if (esErrorInterno(error)) {
      console.error('[SmartWarehouse]', error);
      return;
    }

    this.notifications.error('Ocurrió un error inesperado. Intenta de nuevo.', {
      label: 'Ver detalle',
      run: () => console.error('[SmartWarehouse]', error),
    });

    // No re-lanzamos: el error ya se ha comunicado al usuario.
  }
}

/** Detecta errores del framework de Angular (códigos NG0950, NG8002…). */
function esErrorInterno(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /\bNG\d{3,4}\b/.test(mensaje);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      // View Transitions: cambio de ruta suave sin librería de animaciones.
      withViewTransitions(),
      // Al navegar a un ancla, no deja la cabecera pegada encima.
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),

    provideHttpClient(
      withFetch(),
      withInterceptors([
        // ORDEN IMPORTANTE:
        // 1. jwt — añade el Authorization y renueva el token. Va PRIMERO para
        //    que el mock (o cualquier interceptor posterior) reciba la
        //    petición ya enriquecida; si el mock fuera primero, vería las
        //    llamadas sin cabecera y no podría resolver el usuario.
        // 2. mock — solo si está activo; nunca entra en producción.
        // 3. error — el último, para ver el error final de toda la cadena.
        jwtInterceptor,
        ...(environment.useMockApi ? [mockApiInterceptor] : []),
        errorInterceptor,
      ]),
    ),

    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Service worker (Fase 4.1 del plan).
    //
    // `ngsw-worker.js` **solo existe en el build de producción**: en desarrollo
    // el service worker cachearía el bundle y los cambios que se acabas de
    // guardar no se verían hasta recargar dos veces. Por eso va atado a
    // `isDevMode()`, que además documenta la intención.
    //
    // `registrationStrategy: 'registerWhenStable:30000'` espera a que la app
    // se estabilice 30 s: durante una sesión de trabajo normal el registro no
    // compite por el ancho de banda, y una recarga posterior recoge el SW.
    provideServiceWorker('ngsw-worker.js', {
      enabled: isDevMode() === false,
      registrationStrategy: 'registerWhenStable:30000',
    }),

    // Revalida la sesión guardada al arrancar, antes del primer render de
    // las rutas protegidas.
    provideAppInitializer(() => {
      inject(ThemeService).theme(); // materializa el tema (aplica data-theme)
      inject(ActualizacionService).iniciar(); // aviso de versión nueva (PWA)
      return inject(AuthService).bootstrap();
    }),
  ],
};
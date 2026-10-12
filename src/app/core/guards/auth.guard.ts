import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthStore } from '../store/auth.store';

/**
 * Ruta protegida: exige sesión.
 *
 * Guarda la URL de destino en `returnUrl` para volver allí tras el login.
 * No esperamos a `GET /auth/me`: si hay token guardado, seguimos dentro y
 * `AuthService.bootstrap()` refresca el perfil en segundo plano. Si el token
 * estuviera caducado, el interceptor redirigirá con un 401.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Ruta de invitado (/login, /cambiar-contrasena): si ya hay sesión, al
 * panel. Evita que un usuario autenticado vea el login otra vez.
 */
export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  return store.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * Ruta por rol. Se usa en `canActivate` con datos de ruta:
 *   { path: 'productos', canActivate: [authGuard, roleGuard],
 *     data: { roles: ['Administrador', 'Supervisor'] } }
 *
 * Requiere `authGuard` antes: si no hay sesión, `rolNombre()` es null y
 * el usuario es expulsado a /login.
 */
export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const permitidos = (route.data?.['roles'] as string[] | undefined) ?? [];
  const actual = store.rolNombre();

  if (permitidos.length === 0 || (actual && permitidos.includes(actual))) return true;

  // Sin permiso: al panel, no a una pantalla de "prohibido" (no aporta nada).
  return router.createUrlTree(['/dashboard'], {
    queryParams: { acceso: 'denegado' },
  });
};
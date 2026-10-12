import { type Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Rutas de la aplicación.
 *
 * Todas las features van lazy: el bundle inicial solo contiene el shell
 * (≈ layout + login) y cada sección entra bajo demanda.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Iniciar sesión · SmartWarehouse',
  },
  {
    path: 'mi-cuenta/cambiar-contrasena',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
    title: 'Cambiar contraseña · SmartWarehouse',
  },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Panel · SmartWarehouse',
      },

      // El flujo principal del trabajador: buscar → ubicar → confirmar.
      {
        path: 'busquedas',
        loadChildren: () =>
          import('./features/busquedas/busquedas.routes').then((m) => m.BUSQUEDAS_ROUTES),
      },
      {
        path: 'inventario',
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then((m) => m.INVENTARIO_ROUTES),
      },
      {
        path: 'productos',
        loadChildren: () =>
          import('./features/productos/productos.routes').then((m) => m.PRODUCTOS_ROUTES),
      },
      {
        path: 'ubicaciones',
        loadChildren: () =>
          import('./features/ubicaciones/ubicaciones.routes').then((m) => m.UBICACIONES_ROUTES),
      },
      {
        path: 'escaner',
        loadComponent: () =>
          import('./features/ubicaciones/escaner-qr/escaner-qr.component').then(
            (m) => m.EscanerQrComponent,
          ),
        title: 'Escanear QR · SmartWarehouse',
      },
      {
        path: 'movimientos',
        loadChildren: () =>
          import('./features/movimientos/movimientos.routes').then((m) => m.MOVIMIENTOS_ROUTES),
      },
      {
        path: 'incidencias',
        loadChildren: () =>
          import('./features/incidencias/incidencias.routes').then((m) => m.INCIDENCIAS_ROUTES),
      },
      {
        path: 'metricas',
        loadChildren: () =>
          import('./features/metricas/metricas.routes').then((m) => m.METRICAS_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
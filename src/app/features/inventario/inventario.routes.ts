import { type Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';

/**
 * Rutas de la feature Inventario.
 *
 * - `''`      → alertas de stock bajo mínimo (la vista por defecto: es lo
 *               que un supervisor necesita ver al entrar).
 * - `alertas` → alias del panel, que ya enlazaba a `/inventario/alertas`.
 * - `carga-inicial` → colocar existencias en varios estantes de una vez.
 *   Va ANTES de `:productoId` porque si no, "carga-inicial" se leería como un
 *   id de producto.
 * - `:productoId` → stock consolidado de un producto (distribución por
 *               ubicación). El panel de control enlaza a esta vista.
 */
export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    title: 'Inventario · SmartWarehouse',
    loadComponent: () => import('./alertas/alertas.component').then((m) => m.AlertasComponent),
  },
  {
    path: 'alertas',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'carga-inicial',
    canActivate: [roleGuard],
    data: { roles: ['Administrador', 'Supervisor'] },
    title: 'Carga inicial · SmartWarehouse',
    loadComponent: () =>
      import('./carga-inicial/carga-inicial.component').then((m) => m.CargaInicialComponent),
  },
  {
    path: ':productoId',
    title: 'Stock por producto · SmartWarehouse',
    loadComponent: () =>
      import('./stock-producto/stock-producto.component').then((m) => m.StockProductoComponent),
  },
];
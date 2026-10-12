import { type Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';

/**
 * Métricas: solo Administrador y Supervisor.
 *
 * El backend no protege `/metricas/*` por rol, pero la información es de
 * gestión (no de operación). Ocultarla al Almacenero evita mostrarle datos
 * que no puede cambiar. Ver DECISIONS.md.
 */
export const METRICAS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: ['Administrador', 'Supervisor'] },
    title: 'Métricas · SmartWarehouse',
    loadComponent: () => import('./metricas.component').then((m) => m.MetricasComponent),
  },
];
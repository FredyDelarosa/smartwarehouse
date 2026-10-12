import { type Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';

/**
 * Rutas de Ubicaciones.
 *
 * Crear y editar ubicaciones está restringido a Administrador en el backend,
 * así que esas rutas solo se montan con ese rol. Listado y detalle son
 * accesibles a cualquiera autenticado: son necesarios para buscar productos.
 */
export const UBICACIONES_ROUTES: Routes = [
  {
    path: '',
    title: 'Ubicaciones · SmartWarehouse',
    loadComponent: () =>
      import('./listado/listado.component').then((m) => m.ListadoComponent),
  },
  {
    // Va ANTES de ':id' para que "etiquetas" no se interprete como un id.
    path: 'etiquetas',
    title: 'Etiquetas QR · SmartWarehouse',
    loadComponent: () =>
      import('./etiquetas-qr/etiquetas-qr.component').then((m) => m.EtiquetasQrComponent),
  },
  {
    path: 'nueva',
    canActivate: [roleGuard],
    data: { roles: ['Administrador'] },
    title: 'Nueva ubicación · SmartWarehouse',
    loadComponent: () => import('./form/form.component').then((m) => m.FormComponent),
  },
  {
    path: ':id',
    title: 'Ubicación · SmartWarehouse',
    loadComponent: () => import('./detalle/detalle.component').then((m) => m.DetalleComponent),
  },
  {
    path: ':id/editar',
    canActivate: [roleGuard],
    data: { roles: ['Administrador'] },
    title: 'Editar ubicación · SmartWarehouse',
    loadComponent: () => import('./form/form.component').then((m) => m.FormComponent),
  },
];
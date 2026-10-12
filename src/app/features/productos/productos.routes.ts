import { type Routes } from '@angular/router';

/**
 * Rutas de la feature Productos.
 *
 * El orden importa: `nuevo` está declarado antes que `:id` para que la
 * palabra "nuevo" no se interprete como un id de producto.
 *
 * El mismo componente de formulario sirve para alta y edición; lo que
 * cambia es si la ruta trae `:id` (ver `form.component.ts`).
 */
export const PRODUCTOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Productos · SmartWarehouse',
    loadComponent: () => import('./listado/listado.component').then((m) => m.ListadoComponent),
  },
  {
    path: 'nuevo',
    title: 'Nuevo producto · SmartWarehouse',
    loadComponent: () => import('./form/form.component').then((m) => m.ProductoFormComponent),
  },
  {
    path: ':id',
    title: 'Producto · SmartWarehouse',
    loadComponent: () => import('./detalle/detalle.component').then((m) => m.DetalleComponent),
  },
  {
    path: ':id/editar',
    title: 'Editar producto · SmartWarehouse',
    loadComponent: () => import('./form/form.component').then((m) => m.ProductoFormComponent),
  },
];
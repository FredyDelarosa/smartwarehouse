import { type Routes } from '@angular/router';

/**
 * Rutas de la feature Movimientos.
 *
 * El listado es la pantalla de referencia (consulta); los tres formularios son
 * accesos directos desde el propio listado para quien tiene
 * `movimientos:registrar`.
 */
export const MOVIMIENTOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Movimientos · SmartWarehouse',
    loadComponent: () =>
      import('./listado/listado.component').then((m) => m.MovimientosListadoComponent),
  },
  {
    path: 'entrada',
    title: 'Entrada de producto · SmartWarehouse',
    loadComponent: () => import('./entrada/entrada.component').then((m) => m.EntradaComponent),
  },
  {
    path: 'salida',
    title: 'Salida de producto · SmartWarehouse',
    loadComponent: () => import('./salida/salida.component').then((m) => m.SalidaComponent),
  },
  {
    path: 'traslado',
    title: 'Traslado entre ubicaciones · SmartWarehouse',
    loadComponent: () =>
      import('./traslado/traslado.component').then((m) => m.TrasladoComponent),
  },
];

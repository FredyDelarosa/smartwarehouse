import { type Routes } from '@angular/router';

/**
 * Rutas de la feature Incidencias.
 *
 * `''` es el listado (consulta y resolución); `nueva` es el reporte, que
 * cualquier usuario autenticado puede hacer.
 */
export const INCIDENCIAS_ROUTES: Routes = [
  {
    path: '',
    title: 'Incidencias · SmartWarehouse',
    loadComponent: () =>
      import('./listado/listado.component').then((m) => m.IncidenciasListadoComponent),
  },
  {
    path: 'nueva',
    title: 'Reportar incidencia · SmartWarehouse',
    loadComponent: () => import('./form/form.component').then((m) => m.IncidenciaFormComponent),
  },
];

import { type Routes } from '@angular/router';

/**
 * Rutas de la feature Búsquedas.
 *
 * El plan original preveía tres pantallas (buscar / resultado / historial).
 * Aquí el paso 1 y el 2 comparten componente: el resultado depende del
 * `busqueda_id` que devuelve `iniciar` y que solo existe en memoria durante
 * el mismo flujo. Separarlo obligaría a pasar ese id por la URL y a
 * re-suscribirse a la respuesta. Ver DECISIONS.md.
 */
export const BUSQUEDAS_ROUTES: Routes = [
  { path: '', title: 'Buscar producto · SmartWarehouse', loadComponent: () => import('./buscar/buscar.component').then((m) => m.BuscarComponent) },
  { path: 'historial', title: 'Historial · SmartWarehouse', loadComponent: () => import('./historial/historial.component').then((m) => m.HistorialComponent) },
];
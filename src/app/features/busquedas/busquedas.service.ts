import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import {
  normalizarBusqueda,
  type BusquedaFinalizada,
  type BusquedaHistorial,
  type BusquedaHistorialApi,
  type BusquedaIniciada,
  type FinalizarBusquedaRequest,
  type IniciarBusquedaRequest,
} from '../../core/models/busqueda.model';

/**
 * Endpoints de `/busquedas` — el flujo principal del trabajador:
 *   buscar → ver dónde está → confirmar encontrado (y se cronometra).
 */
@Service()
export class BusquedasService {
  private readonly api = inject(ApiService);

  /** POST /busquedas/iniciar */
  iniciar(request: IniciarBusquedaRequest): Observable<BusquedaIniciada> {
    return this.api.post<BusquedaIniciada>('/busquedas/iniciar', request);
  }

  /** POST /busquedas/{id}/finalizar */
  finalizar(
    busquedaId: number,
    request: FinalizarBusquedaRequest,
  ): Observable<BusquedaFinalizada> {
    return this.api.post<BusquedaFinalizada>(`/busquedas/${busquedaId}/finalizar`, request);
  }

  /**
   * GET /busquedas/historial
   *
   * El servidor devuelve la fila cruda de la tabla (`fecha_hora_inicio`,
   * sin `producto_nombre`), así que aquí se normaliza al modelo de vista.
   */
  historial(skip = 0, limit = 50): Observable<BusquedaHistorial[]> {
    return this.api
      .get<BusquedaHistorialApi[]>('/busquedas/historial', { skip, limit })
      .pipe(map((filas) => filas.map(normalizarBusqueda)));
  }
}
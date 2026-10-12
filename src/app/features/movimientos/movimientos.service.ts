import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  EntradaRequest,
  Movimiento,
  MovimientoQuery,
  MovimientoRequest,
  SalidaRequest,
  TrasladoRequest,
} from '../../core/models/movimiento.model';
import { PAGE_SIZE } from '../../core/models/paginacion.model';
import { ApiService } from '../../core/services/api.service';

/**
 * Endpoints de `/movimientos`.
 *
 * El backend tiene **tres endpoints de alta** (entrada, salida, traslado) en
 * lugar de un `POST /movimientos/` con el tipo dentro. Aquí se mantienen
 * separados y se añade `registrar()` para que los tres formularios compartan
 * código sin conocer la ruta exacta.
 */
@Service()
export class MovimientosService {
  private readonly api = inject(ApiService);

  /**
   * GET /movimientos/
   * Se piden `limit + 1` registros para deducir si hay página siguiente: el
   * backend devuelve un array plano sin `total` (ver core/utils/paginacion.ts).
   */
  listar(query: MovimientoQuery = {}, limiteEfectivo = PAGE_SIZE): Observable<Movimiento[]> {
    return this.api.get<Movimiento[]>('/movimientos/', {
      skip: query.skip ?? 0,
      limit: limiteEfectivo + 1,
      producto_id: query.producto_id ?? undefined,
      ubicacion_id: query.ubicacion_id ?? undefined,
      usuario_id: query.usuario_id ?? undefined,
      tipo: query.tipo ?? undefined,
    });
  }

  /** POST /movimientos/entrada — Almacenero o Supervisor. */
  entrada(payload: EntradaRequest): Observable<Movimiento> {
    return this.api.post<Movimiento>('/movimientos/entrada', payload);
  }

  /** POST /movimientos/salida — Almacenero o Supervisor. */
  salida(payload: SalidaRequest): Observable<Movimiento> {
    return this.api.post<Movimiento>('/movimientos/salida', payload);
  }

  /** POST /movimientos/traslado — Almacenero o Supervisor. */
  traslado(payload: TrasladoRequest): Observable<Movimiento> {
    return this.api.post<Movimiento>('/movimientos/traslado', payload);
  }

  /** Desvía al endpoint que corresponde al tipo de movimiento. */
  registrar(payload: MovimientoRequest): Observable<Movimiento> {
    switch (payload.tipo) {
      case 'ENTRADA':
        return this.entrada(payload);
      case 'SALIDA':
        return this.salida(payload);
      case 'TRASLADO':
        return this.traslado(payload);
    }
  }
}

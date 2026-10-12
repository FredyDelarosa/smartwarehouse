import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  Incidencia,
  IncidenciaCreate,
  IncidenciaQuery,
} from '../../core/models/incidencia.model';
import { PAGE_SIZE } from '../../core/models/paginacion.model';
import { ApiService } from '../../core/services/api.service';

/** Endpoints de `/incidencias`. */
@Service()
export class IncidenciasService {
  private readonly api = inject(ApiService);

  /**
   * GET /incidencias/
   * Como en el resto de listados, se piden `limit + 1` registros para saber
   * si hay página siguiente sin que el backend devuelva un `total`.
   */
  listar(query: IncidenciaQuery = {}, limiteEfectivo = PAGE_SIZE): Observable<Incidencia[]> {
    return this.api.get<Incidencia[]>('/incidencias/', {
      skip: query.skip ?? 0,
      limit: limiteEfectivo + 1,
      tipo: query.tipo ?? undefined,
      resuelta: query.resuelta ?? undefined,
      producto_id: query.producto_id ?? undefined,
      desde: query.desde ?? undefined,
      hasta: query.hasta ?? undefined,
    });
  }

  /** POST /incidencias/ — requiere autenticación (cualquier rol). */
  crear(payload: IncidenciaCreate): Observable<Incidencia> {
    return this.api.post<Incidencia>('/incidencias/', payload);
  }

  /** POST /incidencias/{id}/resolver — Almacenero o Supervisor. */
  resolver(id: number): Observable<Incidencia> {
    return this.api.post<Incidencia>(`/incidencias/${id}/resolver`);
  }
}

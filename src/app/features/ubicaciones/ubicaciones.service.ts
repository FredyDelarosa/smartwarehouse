import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import type {
  Ubicacion,
  UbicacionCreate,
  UbicacionQuery,
  UbicacionUpdate,
  UbicacionConProductos,
} from '../../core/models/ubicacion.model';

/**
 * Endpoints de `/ubicaciones`.
 */
@Service()
export class UbicacionesService {
  private readonly api = inject(ApiService);

  /** GET /ubicaciones/ — el servicio pide limit+1 para deducir "hay más". */
  listar(query: UbicacionQuery = {}, limiteEfectivo = 20): Observable<Ubicacion[]> {
    return this.api.get<Ubicacion[]>('/ubicaciones/', {
      almacen_id: query.almacen_id ?? undefined,
      solo_activas: query.solo_activas ?? undefined,
      skip: query.skip ?? 0,
      limit: limiteEfectivo + 1,
    });
  }

  /** GET /ubicaciones/almacen/{almacen_id} */
  porAlmacen(almacenId: number, skip = 0, limit = 200): Observable<Ubicacion[]> {
    return this.api.get<Ubicacion[]>(`/ubicaciones/almacen/${almacenId}`, { skip, limit });
  }

  /** GET /ubicaciones/{id} */
  obtener(id: number): Observable<Ubicacion> {
    return this.api.get<Ubicacion>(`/ubicaciones/${id}`);
  }

  /** GET /ubicaciones/qr/{codigo_qr} — incluye los productos de la ubicación. */
  porQr(codigoQr: string): Observable<UbicacionConProductos> {
    return this.api.get<UbicacionConProductos>(
      `/ubicaciones/qr/${encodeURIComponent(codigoQr)}`,
    );
  }

  /** POST /ubicaciones/ — requiere Administrador. */
  crear(payload: UbicacionCreate): Observable<Ubicacion> {
    return this.api.post<Ubicacion>('/ubicaciones/', payload);
  }

  /** PATCH /ubicaciones/{id} */
  actualizar(id: number, payload: UbicacionUpdate): Observable<Ubicacion> {
    return this.api.patch<Ubicacion>(`/ubicaciones/${id}`, payload);
  }
}
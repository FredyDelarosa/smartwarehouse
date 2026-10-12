import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import type {
  Comparativa,
  DashboardResumen,
  ResumenIncidencias,
  ResumenMovimientos,
  TiempoPromedio,
} from '../../core/models/metrica.model';

/**
 * Endpoints de `/metricas`.
 *
 * `comparativa()` exige los cuatro parámetros de fecha (el backend responde
 * 422 si falta alguno), por eso aquí no hay valores por defecto: quien llama
 * decide los dos periodos que quiere comparar.
 */
@Service()
export class MetricasService {
  private readonly api = inject(ApiService);

  /** GET /metricas/dashboard — los 6 KPIs. */
  dashboard(): Observable<DashboardResumen> {
    return this.api.get<DashboardResumen>('/metricas/dashboard');
  }

  /** GET /metricas/tiempo-promedio — `desde`/`hasta` opcionales (ISO 8601). */
  tiempoPromedio(desde?: string | null, hasta?: string | null): Observable<TiempoPromedio> {
    return this.api.get<TiempoPromedio>('/metricas/tiempo-promedio', {
      desde: desde ?? undefined,
      hasta: hasta ?? undefined,
    });
  }

  /** GET /metricas/comparativa — los 4 parámetros son obligatorios. */
  comparativa(params: {
    desdeAnterior: string;
    hastaAnterior: string;
    desdeActual: string;
    hastaActual: string;
  }): Observable<Comparativa> {
    return this.api.get<Comparativa>('/metricas/comparativa', {
      desde_anterior: params.desdeAnterior,
      hasta_anterior: params.hastaAnterior,
      desde_actual: params.desdeActual,
      hasta_actual: params.hastaActual,
    });
  }

  /** GET /metricas/incidencias */
  incidencias(): Observable<ResumenIncidencias> {
    return this.api.get<ResumenIncidencias>('/metricas/incidencias');
  }

  /** GET /metricas/movimientos */
  movimientos(): Observable<ResumenMovimientos> {
    return this.api.get<ResumenMovimientos>('/metricas/movimientos');
  }
}
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  ConfigAlmacenRequest,
  GeneracionResult,
  Previsualizacion,
  ResumenAlmacen,
} from '../models/configuracion.model';
import { ApiService } from './api.service';

/**
 * Configuración del almacén por cuestionario (PET-4, fases 3 y 4).
 *
 * El cuestionario se responde aquí arriba; estas llamadas son el respaldo:
 * `previsualizar` no escribe nada y es la pantalla de confirmación, y
 * `generar` es el único punto que toca la base.
 */
@Service()
export class ConfiguracionService {
  private readonly api = inject(ApiService);

  /** Dice lo que se crearía, sin escribir. Alimenta la pantalla de confirmar. */
  previsualizar(config: ConfigAlmacenRequest): Observable<Previsualizacion> {
    return this.api.post<Previsualizacion>('/configuracion/previsualizar', config);
  }

  /** Crea las ubicaciones que falten y devuelve cuántas. */
  generar(config: ConfigAlmacenRequest): Observable<GeneracionResult> {
    return this.api.post<GeneracionResult>('/configuracion/generar', config);
  }

  /** Estado actual: para saber si el almacén ya está configurado. */
  resumen(): Observable<ResumenAlmacen> {
    return this.api.get<ResumenAlmacen>('/configuracion/almacen');
  }
}
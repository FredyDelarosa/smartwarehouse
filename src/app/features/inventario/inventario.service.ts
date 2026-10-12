import { inject, Service } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import type { AlertaStock, StockProducto } from '../../core/models/inventario.model';

/**
 * Endpoints de `/inventario`.
 *
 * `/inventario` es de solo lectura: el stock cambia por movimientos
 * (POST /movimientos/…), nunca editando el inventario a mano.
 */
@Service()
export class InventarioService {
  private readonly api = inject(ApiService);

  /**
   * Cache en memoria de stock por producto.
   *
   * No es un endpoint de stock, es una optimisation de UI: la columna de
   * stock del listado necesita el dato de N productos y el backend solo
   * expone uno por llamada (ver `stockDe`). Guardamos lo ya consultado para
   * que voltar atrás en la paginación no vuelva a pegarle al servidor por
   * los mismos ids. `limpiarCache()` la invalida cuando el stock cambia.
   */
  private readonly cache = new Map<number, StockProducto>();

  /** GET /inventario/producto/{id} — stock consolidado + distribución. */
  stockProducto(productoId: number): Observable<StockProducto> {
    return this.api.get<StockProducto>(`/inventario/producto/${productoId}`);
  }

  /** GET /inventario/alertas — productos por debajo del mínimo. */
  alertas(): Observable<AlertaStock[]> {
    return this.api.get<AlertaStock[]>('/inventario/alertas');
  }

  /**
   * Stock de varios productos en una sola llamada lógica.
   *
   * El backend no tiene endpoint batch, así que internamente pide uno por
   * producto SOLO para los que no tiene en cache. Un fallo puntual (404, red)
   * no tumba el resto: ese id vuelve como `null` y la UI muestra "—".
   */
  stockDe(ids: readonly number[]): Observable<Map<number, StockProducto | null>> {
    const unicos = [...new Set(ids)];
    const faltantes = unicos.filter((id) => !this.cache.has(id));

    if (faltantes.length === 0) return of(this.mapaDe(unicos));

    return forkJoin(
      faltantes.map((id) =>
        this.stockProducto(id).pipe(
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      map((respuestas) => {
        respuestas.forEach((stock, i) => {
          const id = faltantes[i]!;
          // `null` no se cachea: puede ser un 404 transitorio.
          if (stock) this.cache.set(id, stock);
        });
        return this.mapaDe(unicos);
      }),
    );
  }

  /** Invalida la cache (tras un movimiento, una baja o una edición). */
  limpiarCache(): void {
    this.cache.clear();
  }

  private mapaDe(ids: readonly number[]): Map<number, StockProducto | null> {
    return new Map(ids.map((id) => [id, this.cache.get(id) ?? null]));
  }
}
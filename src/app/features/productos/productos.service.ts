import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import type {
  Producto,
  ProductoCreate,
  ProductoListado,
  ProductoQuery,
  ProductoSearchQuery,
  ProductoUpdate,
} from '../../core/models/producto.model';
import { PAGE_SIZE } from '../../core/models/paginacion.model';

/**
 * Endpoints de `/productos`.
 *
 * Todos devuelven `Observable<T>`; el componente decide cuándo suscribirse
 * (típicamente con `toSignal` o `switchMap`).
 */
@Service()
export class ProductosService {
  private readonly api = inject(ApiService);

  /**
   * GET /productos/
   * Pedimos `limit + 1` para poder deducir si hay página siguiente, ya que
   * el backend no devuelve `total`. Ver core/utils/paginacion.ts.
   */
  listar(query: ProductoQuery = {}, limiteEfectivo = PAGE_SIZE): Observable<ProductoListado> {
    return this.api.get<ProductoListado>('/productos/', {
      skip: query.skip ?? 0,
      limit: limiteEfectivo + 1,
      categoria_id: query.categoria_id ?? undefined,
      solo_activos: query.solo_activos ?? undefined,
    });
  }

  /** GET /productos/buscar — used por el autocomplete de búsqueda. */
  buscar(query: ProductoSearchQuery): Observable<ProductoListado> {
    return this.api.get<ProductoListado>('/productos/buscar', {
      termino: query.termino,
      limit: query.limit ?? 20,
    });
  }

  /** GET /productos/{id} */
  obtener(id: number): Observable<Producto> {
    return this.api.get<Producto>(`/productos/${id}`);
  }

  /** POST /productos/ — requiere Administrador o Supervisor. */
  crear(payload: ProductoCreate): Observable<Producto> {
    return this.api.post<Producto>('/productos/', payload);
  }

  /** PATCH /productos/{id} — requiere Administrador o Supervisor. */
  actualizar(id: number, payload: ProductoUpdate): Observable<Producto> {
    return this.api.patch<Producto>(`/productos/${id}`, payload);
  }

  /** DELETE /productos/{id} — requiere Administrador. Baja lógica (204). */
  eliminar(id: number): Observable<null> {
    return this.api.delete<null>(`/productos/${id}`);
  }
}
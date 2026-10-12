import { Service, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';

import type { Ubicacion } from '../../core/models/ubicacion.model';
import { ApiService } from '../../core/services/api.service';

/** Cuántas ubicaciones se piden de golpe para los selectores. */
export const MAX_UBICACIONES = 200;

/**
 * Caché de ubicaciones, compartida por toda la sesión.
 *
 * Dos usos distintos, un solo servicio:
 *
 *  1. **Etiquetas puntuales** (`GET /ubicaciones/{id}`): un movimiento solo
 *     trae `ubicacion_origen_id`. Resolvemos el código una vez por id y lo
 *     guardamos en un `signal<Map>`; las siguientes filas salen gratis.
 *  2. **Listado completo** (`GET /ubicaciones/?limit=200`): los selectores de
 *     entrada/salida/traslado filtran en memoria. Se pide una sola vez por
 *     sesión y se reutiliza entre los tres formularios.
 */
@Service()
export class UbicacionesLookupService {
  private readonly api = inject(ApiService);

  private readonly _cache = signal<ReadonlyMap<number, Ubicacion>>(new Map());
  private readonly _enCurso = new Set<number>();
  private listado$: Observable<Ubicacion[]> | null = null;

  /** id → ubicación. Se lee desde los templates. */
  readonly cache = this._cache.asReadonly();

  /** "P3-A-01", o null si todavía no se ha pedido. */
  codigoDe(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this._cache().get(id)?.codigo_ubicacion ?? null;
  }

  ubicacionDe(id: number | null | undefined): Ubicacion | null {
    if (id === null || id === undefined) return null;
    return this._cache().get(id) ?? null;
  }

  /** Pide la ubicación si no está en caché. Idempotente. */
  asegurar(id: number | null | undefined): void {
    if (id === null || id === undefined) return;
    if (this._cache().has(id) || this._enCurso.has(id)) return;

    this._enCurso.add(id);
    this.api
      .get<Ubicacion>(`/ubicaciones/${id}`)
      .pipe(finalize(() => this._enCurso.delete(id)))
      .subscribe({
        next: (u) => this.guardar(u),
        // Silencioso: si la ubicación ya no existe, la fila cae al "#id".
        error: () => undefined,
      });
  }

  /** Precarga los ids de una página de movimientos (origen y destino). */
  asegurarVarios(ids: Iterable<number | null | undefined>): void {
    for (const id of ids) this.asegurar(id);
  }

  /**
   * Listado completo para los selectores: una sola petición por sesión
   * (`shareReplay`), con filtro en memoria del lado del componente.
   *
   * Se piden también las inactivas: una ubicación dada de baja puede seguir
   * teniendo existencias y debe poder elegirse como origen de una salida.
   */
  listar(limite = MAX_UBICACIONES): Observable<Ubicacion[]> {
    this.listado$ ??= this.api
      .get<Ubicacion[]>('/ubicaciones/', { limit: limite, solo_activas: false })
      .pipe(
        tap((lista) => this.guardarVarios(lista)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.listado$;
  }

  /** GET /ubicaciones/{id} */
  obtener(id: number): Observable<Ubicacion> {
    return this.api.get<Ubicacion>(`/ubicaciones/${id}`).pipe(tap((u) => this.guardar(u)));
  }

  private guardar(u: Ubicacion): void {
    this._cache.update((mapa) => new Map(mapa).set(u.id, u));
  }

  private guardarVarios(lista: Ubicacion[]): void {
    if (lista.length === 0) return;
    this._cache.update((mapa) => {
      const copia = new Map(mapa);
      for (const u of lista) copia.set(u.id, u);
      return copia;
    });
  }
}

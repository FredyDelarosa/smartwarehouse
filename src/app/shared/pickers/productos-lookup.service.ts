import { Service, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';

import type { Producto } from '../../core/models/producto.model';
import { ApiService } from '../../core/services/api.service';

/**
 * Caché de productos para las vistas que solo conocen el `producto_id`
 * (listados de movimientos e incidencias).
 *
 * Por qué existe: `GET /movimientos/` y `GET /incidencias/` devuelven el id
 * del producto, no su nombre. Resolverlo con un `GET /productos/{id}` por
 * fila sería N peticiones por página; aquí se resuelve **una vez** y se
 * comparte entre todas las vistas de la sesión.
 *
 * El estado vive en un `signal<Map<number, Producto>>`: cuando llega una
 * respuesta, las tablas que ya lo leyeron en su template se repintan solas
 * (Angular rastrea la lectura de signals durante el render).
 */
@Service()
export class ProductosLookupService {
  private readonly api = inject(ApiService);

  private readonly _cache = signal<ReadonlyMap<number, Producto>>(new Map());
  /** ids con una petición en vuelo: evita ráfagas al montar la tabla. */
  private readonly _enCurso = new Set<number>();

  /** id → producto. Se lee (y se actualiza) desde los templates. */
  readonly cache = this._cache.asReadonly();

  /** "T001 · Tornillos 1/4", o null si el producto aún no ha llegado. */
  etiquetaDe(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    const p = this._cache().get(id);
    return p ? `${p.codigo} · ${p.nombre}` : null;
  }

  codigoDe(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this._cache().get(id)?.codigo ?? null;
  }

  nombreDe(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this._cache().get(id)?.nombre ?? null;
  }

  /** Unidad de medida, para escribir "350 piezas" sin adivinar. */
  unidadDe(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this._cache().get(id)?.unidad_medida ?? null;
  }

  /** Pide el producto si no está en caché. Idempotente. */
  asegurar(id: number | null | undefined): void {
    if (id === null || id === undefined) return;
    if (this._cache().has(id) || this._enCurso.has(id)) return;

    this._enCurso.add(id);
    this.api
      .get<Producto>(`/productos/${id}`)
      .pipe(finalize(() => this._enCurso.delete(id)))
      .subscribe({
        next: (p) => this.guardar(p),
        // Silencioso a propósito: una fila sin nombre no debe ensuciar la
        // pantalla con un error; la tabla cae al "#id".
        error: () => undefined,
      });
  }

  /** Precarga los ids de una página entera con una petición por cada uno. */
  asegurarVarios(ids: Iterable<number | null | undefined>): void {
    for (const id of ids) this.asegurar(id);
  }

  /**
   * GET /productos/buscar — alimenta el autocomplete.
   * Los resultados se cachean: elegir uno de la lista no cuesta otra
   * petición y las tablas lo reutilizan.
   */
  buscar(termino: string, limite = 8): Observable<Producto[]> {
    return this.api
      .get<Producto[]>('/productos/buscar', { termino, limit: limite })
      .pipe(tap((lista) => this.guardarVarios(lista)));
  }

  /** GET /productos/{id} */
  obtener(id: number): Observable<Producto> {
    return this.api.get<Producto>(`/productos/${id}`).pipe(tap((p) => this.guardar(p)));
  }

  private guardar(p: Producto): void {
    this._cache.update((mapa) => new Map(mapa).set(p.id, p));
  }

  private guardarVarios(lista: Producto[]): void {
    if (lista.length === 0) return;
    this._cache.update((mapa) => {
      const copia = new Map(mapa);
      for (const p of lista) copia.set(p.id, p);
      return copia;
    });
  }
}

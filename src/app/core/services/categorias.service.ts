import { computed, inject, Injectable, Service, signal } from '@angular/core';

import type { Categoria, CategoriaOpcion } from '../models/categoria.model';
import { ApiService } from './api.service';
import { ApiError } from '../models/error.model';

/** Espera mínima antes de volver a pedir el catálogo tras un fallo. */
const ENFRIAMIENTO_MS = 30_000;

/**
 * Catálogo de categorías de producto.
 *
 * ⚠️ El backend tiene la ruta pero `GET /categorias/` responde 500 (ver DECISIONS.md
 * "PET-1"). Este servicio está escrito contra el contrato previsto, así que
 * en cuanto el endpoint exista la app lo usa sin cambios.
 *
 * Mientras tanto **no rompe nada**: si la llamada falla con 404, se marca
 * `disponible = false` y la UI lo explica. Los ids que ya tengan un producto
 * se muestran como "Categoría #N (sin catálogo)" para que el usuario nunca
 * vea un número desnudo, y **se conservan al guardar** (el `<select>` incluye
 * una opción provisional con el id actual).
 */
@Service()
export class CategoriasService {
  private readonly api = inject(ApiService);

  private readonly _items = signal<Categoria[]>([]);
  private readonly _disponible = signal<boolean | null>(null); // null = sin pedir aún
  private readonly _cargando = signal(false);

  readonly items = this._items.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  /** false cuando el backend no expone el catálogo. */
  readonly disponible = this._disponible.asReadonly();

  private cargado = false;

  /** Momento del último fallo, para el enfriamiento de reintentos. */
  private ultimoFallo: number | null = null;

  /** Opciones para el `<select>` del formulario de producto. */
  readonly opciones = computed<CategoriaOpcion[]>(() =>
    this._items()
      .filter((c) => c.activo !== false)
      .map((c) => ({
        value: c.id,
        label: c.nombre,
        descripcion: c.descripcion,
        provisional: false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  );

  /** Nombre legible de un id, o la etiqueta provisional si no hay catálogo. */
  readonly nombreDe = computed(() => {
    const mapa = new Map(this._items().map((c) => [c.id, c.nombre]));
    return (id: number | null | undefined): string | null => {
      if (id === null || id === undefined) return null;
      return mapa.get(id) ?? `Categoría #${id}`;
    };
  });

  /**
   * Carga el catálogo una sola vez. Es idempotente y no bloquea: la UI
   * renderiza igual mientras se pide.
   */
  cargar(): void {
    if (this.cargado || this._cargando()) return;

    // Enfriamiento: sin esto, con el backend caído, cada pantalla que llama a
    // `cargar()` dispararía una petición nueva y la API recibiría un goteo
    // constante. 30 s es suficiente para que se recupere sola tras un
    // reinicio del servidor sin castigar al usuario.
    if (this.ultimoFallo !== null && Date.now() - this.ultimoFallo < ENFRIAMIENTO_MS) {
      return;
    }

    this.cargado = true;
    this._cargando.set(true);

    this.api.get<Categoria[]>('/categorias/').subscribe({
      next: (lista) => {
        this._items.set(Array.isArray(lista) ? lista : []);
        this._disponible.set(true);
        this._cargando.set(false);
      },
      error: (err: unknown) => {
        // Cualquier fallo significa que NO tenemos catálogo, así que
        // `disponible` va a false en todos los casos. Antes un 500 ponía
        // `true` (por un `!isNotFound` invertido), y la UI se creía que el
        // catálogo estaba disponible mientras mostraba la lista vacía.
        this._disponible.set(false);

        const es404 = err instanceof ApiError && err.isNotFound;
        if (!es404) {
          // Un 404 es el caso esperado mientras el backend no tenga la ruta.
          // Cualquier otro error sí es una avería y conviene verla en consola.
          console.warn('[categorías] no se pudo cargar el catálogo', err);
        }

        // **Reintentable.** Antes `cargado` se quedaba en `true` para siempre:
        // un único fallo transitorio (el backend reiniciándose, un 401 al
        // expirar el token, un corte de red) dejaba la app mostrando
        // "Categoría #N (sin catálogo)" hasta que se recargara la página.
        // Aquí se libera el candado para que el siguiente `cargar()` reintente.
        this.cargado = false;
        this.ultimoFallo = Date.now();
        this._cargando.set(false);
      },
    });
  }

  /** Fuerza una recarga (tras crear/editar una categoría, por ejemplo). */
  recargar(): void {
    // Es una acción explícita: el enfriamiento no aplica aquí.
    this.ultimoFallo = null;
    this.cargado = false;
    this.cargar();
  }

  /**
   * Opciones listas para pintar, incluyendo una entrada provisional para un id
   * que no está en el catálogo.
   *
   * Esto es lo que evita el bug de pérdida de datos: si un producto viene con
   * `categoria_id = 5` y el catálogo está caído, el `<select>` incluye
   * "Categoría #5 (sin catálogo)" con valor 5. Si el usuario guarda, el 5 se
   * conserva.
   */
  opcionesConFallback(idActual: number | null): CategoriaOpcion[] {
    const base = this.opciones();
    if (idActual === null || base.some((o) => o.value === idActual)) return base;

    return [
      ...base,
      {
        value: idActual,
        label: `Categoría #${idActual} (sin catálogo)`,
        descripcion: 'El servidor no expone el catálogo de categorías.',
        provisional: true,
      },
    ];
  }
}

/** Reexportado por comodidad para los que ya importan desde core/models. */
export type { Categoria, CategoriaOpcion };
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, of, startWith, switchMap } from 'rxjs';

import type { Producto, ProductoListado } from '../../../core/models/producto.model';
import type { StockProducto } from '../../../core/models/inventario.model';
import { PAGE_SIZE } from '../../../core/models/paginacion.model';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/store/auth.store';
import { debounceInput } from '../../../core/utils/async';
import { formatNumber } from '../../../core/utils/format';
import { normalizarPagina, paginaParams, rangoTexto } from '../../../core/utils/paginacion';
import { BadgeComponent, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ModalComponent } from '../../../shared/components/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { InventarioService } from '../../inventario/inventario.service';
import { ProductosService } from '../productos.service';

/** Espera tras la última tecla antes de buscar por nombre/código. */
const DEBOUNCE_MS = 250;
/** Mínimo de caracteres para que la búsqueda tenga sentido (mismo corte que el autocomplete). */
const MIN_TERMINO = 2;

type StockMap = Map<number, StockProducto | null>;

/**
 * Listado del catálogo de productos.
 *
 * Dos fuentes de datos según lo que haya escrito el usuario:
 *  - sin término → `GET /productos/` paginado (limit+1, ver paginacion.ts);
 *  - con término  → `GET /productos/buscar`, que NO pagina y por eso el pie
 *    de paginación se sustituye por el contador de coincidencias.
 *
 * La columna de stock viene de `GET /inventario/producto/{id}`, uno por
 * producto: no hay endpoint batch. Para no disparar 20 peticiones cada vez
 * que se cambia de página, `InventarioService` cachea lo ya consultado.
 */
@Component({
  selector: 'sw-productos-listado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listado.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    ModalComponent,
    PaginationComponent,
    SkeletonTableComponent,
  ],
})
export class ListadoComponent {
  private readonly api = inject(ApiService);
  private readonly productos = inject(ProductosService);
  private readonly inventario = inject(InventarioService);
  private readonly notify = inject(NotificationService);
  private readonly store = inject(AuthStore);

  private readonly busqueda = debounceInput<string>(DEBOUNCE_MS);

  // ── Estado local ───────────────────────────────────────────────────────
  protected readonly termino = signal('');
  protected readonly soloActivos = signal(true);
  /** Página 0-based. */
  protected readonly page = signal(0);

  /** Término ya pasado por el debounce: es el que dispara peticiones. */
  protected readonly terminoDebounced = toSignal(this.busqueda.value$.pipe(startWith('')), {
    initialValue: '',
  });

  protected readonly enBusqueda = computed(
    () => this.terminoDebounced().trim().length >= MIN_TERMINO,
  );

  // ── Datos ──────────────────────────────────────────────────────────────
  readonly listado = httpResource<ProductoListado>(() => {
    // Mientras hay búsqueda el listado paginado no aporta nada: no lo pedimos.
    if (this.enBusqueda()) return undefined;
    const { skip, limit } = paginaParams(this.page(), PAGE_SIZE);
    return this.api.url('/productos/', {
      skip,
      // limit + 1: así sabremos si hay página siguiente sin pedir un total.
      limit: limit + 1,
      solo_activos: this.soloActivos() ? true : undefined,
    });
  });

  readonly resultados = httpResource<ProductoListado>(() => {
    const t = this.terminoDebounced().trim();
    return t.length >= MIN_TERMINO
      ? this.api.url('/productos/buscar', { termino: t, limit: PAGE_SIZE })
      : undefined;
  });

  protected readonly paginaActual = computed(() =>
    normalizarPagina(this.listado.value() ?? [], this.page(), PAGE_SIZE),
  );

  protected readonly filas = computed(() =>
    this.enBusqueda() ? (this.resultados.value() ?? []) : this.paginaActual().items,
  );

  protected readonly rango = computed(() => rangoTexto(this.paginaActual()));

  /** Ids visibles → pide el stock de los que falte y lo deja en un Map. */
  private readonly idsVisibles = toObservable(computed(() => this.filas().map((p) => p.id)));

  protected readonly stocks = toSignal(
    this.idsVisibles.pipe(
      distinctUntilChanged((a, b) => a.length === b.length && a.every((id, i) => id === b[i])),
      switchMap((ids) =>
        ids.length > 0 ? this.inventario.stockDe(ids) : of<StockMap>(new Map()),
      ),
    ),
    { initialValue: new Map<number, StockProducto | null>() },
  );

  // ── Permisos (UI, no autorización: el backend sigue validando) ─────────
  protected readonly puedeCrear = computed(() => this.store.can('productos:crear'));
  protected readonly puedeEditar = computed(() => this.store.can('productos:editar'));
  protected readonly puedeEliminar = computed(() => this.store.can('productos:eliminar'));

  // ── Baja lógica ────────────────────────────────────────────────────────
  protected readonly bajaAbierta = signal(false);
  protected readonly bajaObjetivo = signal<Producto | null>(null);
  protected readonly dandoDeBaja = signal(false);

  protected readonly fmt = { formatNumber };

  /** Cuántos resultados devuelve `GET /productos/buscar` por consulta. */
  protected readonly limiteBusqueda = PAGE_SIZE;

  // ── Búsqueda / filtros / paginación ────────────────────────────────────
  protected onInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.termino.set(valor);
    this.busqueda.input$.next(valor);
  }

  protected limpiarBusqueda(): void {
    this.termino.set('');
    this.busqueda.input$.next('');
  }

  protected alternarSoloActivos(): void {
    this.soloActivos.update((v) => !v);
    this.page.set(0);
  }

  protected irAPagina(page: number): void {
    this.page.set(Math.max(0, page));
  }

  /** Recarga lo que esté en pantalla: listado paginado o resultados de búsqueda. */
  protected refrescar(): void {
    if (this.enBusqueda()) {
      this.resultados.reload();
    } else {
      this.listado.reload();
    }
  }

  // ── Acciones ───────────────────────────────────────────────────────────
  protected pedirBaja(producto: Producto): void {
    this.bajaObjetivo.set(producto);
    this.bajaAbierta.set(true);
  }

  protected cancelarBaja(): void {
    this.bajaAbierta.set(false);
    this.bajaObjetivo.set(null);
  }

  protected confirmarBaja(): void {
    const producto = this.bajaObjetivo();
    if (!producto || this.dandoDeBaja()) return;

    this.dandoDeBaja.set(true);
    this.productos.eliminar(producto.id).subscribe({
      next: () => {
        this.dandoDeBaja.set(false);
        this.cancelarBaja();
        this.notify.success(`Producto ${producto.codigo} dado de baja.`);
        // El stock cacheado puede venir de antes de la baja.
        this.inventario.limpiarCache();
        this.listado.reload();
        this.resultados.reload();
      },
      error: (err: unknown) => {
        this.dandoDeBaja.set(false);
        this.notify.apiError(err, 'No se pudo dar de baja el producto.');
      },
    });
  }

  // ── Presentación ───────────────────────────────────────────────────────
  /** Stock conocido de un producto, o `null` si aún no ha llegado. */
  protected stockDe(producto: Producto): StockProducto | null {
    return this.stocks().get(producto.id) ?? null;
  }

  protected tonoEstado(activo: boolean): BadgeTone {
    return activo ? 'success' : 'neutral';
  }

  /** "Agotado" / "Bajo mínimo" / "12 unidades" según lo que sepa del stock. */
  protected estadoStock(producto: Producto): { texto: string; tone: BadgeTone } {
    const stock = this.stockDe(producto);
    if (!stock) return { texto: '—', tone: 'neutral' };
    if (stock.stock_total <= 0) return { texto: 'Agotado', tone: 'danger' };
    if (stock.requiere_alerta) return { texto: 'Bajo mínimo', tone: 'warning' };
    return { texto: 'Cubierto', tone: 'success' };
  }
}
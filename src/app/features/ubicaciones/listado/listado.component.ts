import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  ProductoEnUbicacion,
  Ubicacion,
  UbicacionStock,
} from '../../../core/models/ubicacion.model';
import { ApiService } from '../../../core/services/api.service';
import { PAGE_SIZE } from '../../../core/models/paginacion.model';
import { normalizarPagina, paginaParams, rangoTexto } from '../../../core/utils/paginacion';
import { IconComponent } from '../../../shared/components/icon.component';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { AuthStore } from '../../../core/store/auth.store';
import { UbicacionesService } from '../ubicaciones.service';

/**
 * Listado de ubicaciones del almacén (pasillo / estante / nivel).
 *
 * El worker llega aquí sobre todo desde el escáner QR, así que la búsqueda
 * por código es la acción principal y está en el foco.
 */
@Component({
  selector: 'sw-ubicaciones-listado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listado.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    PaginationComponent,
    SkeletonTableComponent,
  ],
})
export class ListadoComponent {
  private readonly ubicaciones = inject(UbicacionesService);
  private readonly api = inject(ApiService);
  readonly store = inject(AuthStore);

  /** Permite al padre (o al router) reiniciar la página. */
  readonly soloActivas = input<boolean>(true);

  protected readonly pagina = signal(0);
  protected readonly filtro = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<Ubicacion[]>([]);
  protected readonly tieneMas = signal(false);

  protected readonly puedeCrear = computed(() => this.store.can('ubicaciones:crear'));

  /**
   * Stock por ubicación, indexado por id para no buscar linealmente en cada
   * fila del `@for`.
   *
   * ⚠️ Depende de `GET /inventario/ubicaciones`, que **aún no existe** (ver
   * PET-3 en DECISIONS.md). Mientras tanto el mapa queda vacío y la columna
   * muestra "—": es preferible a pedir `/ubicaciones/qr/{c}` por fila, que
   * serían 20 peticiones por página.
   */
  private readonly stockPorId = signal<Map<number, UbicacionStock>>(new Map());
  protected readonly stockNoDisponible = signal(true);

  /** Productos de una ubicación, o `null` si el endpoint no responde. */
  protected stockDe(ubicacionId: number): ProductoEnUbicacion[] | null {
    const fila = this.stockPorId().get(ubicacionId);
    return fila ? fila.productos : null;
  }

  /** Unidades totales de una ubicación. */
  protected totalDe(ubicacionId: number): number | null {
    return this.stockPorId().get(ubicacionId)?.total_unidades ?? null;
  }

  private cargarStock(): void {
    this.api.get<UbicacionStock[]>('/inventario/ubicaciones', { skip: 0, limit: 500 }).subscribe({
      next: (lista) => {
        this.stockPorId.set(new Map((lista ?? []).map((f) => [f.ubicacion_id, f])));
        this.stockNoDisponible.set(false);
      },
      // 404 = el endpoint todavía no existe. No es un fallo de pantalla: se
      // muestra la columna vacía y el resto del listado sigue siendo útil.
      error: () => this.stockNoDisponible.set(true),
    });
  }

  /** Aplica el filtro de texto sobre la página ya cargada. */
  protected readonly visibles = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (texto.length === 0) return this.items();
    return this.items().filter(
      (u) =>
        u.codigo_ubicacion.toLowerCase().includes(texto) ||
        u.codigo_qr.toLowerCase().includes(texto) ||
        u.pasillo.toLowerCase().includes(texto),
    );
  });

  protected readonly rango = computed(() =>
    rangoTexto(
      {
        items: this.visibles(),
        page: this.pagina(),
        limit: PAGE_SIZE,
        hasNext: this.tieneMas(),
        hasPrev: this.pagina() > 0,
      },
      null,
    ),
  );

  constructor() {
    this.cargar();
    this.cargarStock();
  }

  protected onFiltro(event: Event): void {
    this.filtro.set((event.target as HTMLInputElement).value);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.max(0, pagina));
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const { skip, limit } = paginaParams(this.pagina(), PAGE_SIZE);

    this.ubicaciones.listar({ skip, solo_activas: this.soloActivas() }, limit).subscribe({
      next: (respuesta) => {
        const pag = normalizarPagina(respuesta, this.pagina(), PAGE_SIZE);
        this.items.set(pag.items);
        this.tieneMas.set(pag.hasNext);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar las ubicaciones.');
        this.items.set([]);
      },
    });
  }
}
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Movimiento, MovimientoTipo } from '../../../core/models/movimiento.model';
import { MOVIMIENTO_TIPOS } from '../../../core/models/movimiento.model';
import { PAGE_SIZE } from '../../../core/models/paginacion.model';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { formatCantidad, formatDateTime, formatNumber, formatRelative } from '../../../core/utils/format';
import { normalizarPagina, rangoTexto } from '../../../core/utils/paginacion';
import { BadgeComponent, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { ProductoPickerComponent } from '../../../shared/pickers/producto-picker.component';
import { ProductosLookupService } from '../../../shared/pickers/productos-lookup.service';
import { UbicacionesLookupService } from '../../../shared/pickers/ubicaciones-lookup.service';

/** Un tipo vacío en el filtro = "todos". */
type TipoFiltro = MovimientoTipo | '';

const ETIQUETA_TIPO: Record<MovimientoTipo, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
  AJUSTE: 'Ajuste',
};

/** Un color por tipo: entra verde, sale azul, traslada violeta, ajusta ámbar. */
const TONE_TIPO: Record<MovimientoTipo, BadgeTone> = {
  ENTRADA: 'success',
  SALIDA: 'info',
  TRASLADO: 'accent',
  AJUSTE: 'warning',
};

/**
 * Listado de movimientos con filtros y paginación.
 *
 * `httpResource` pide la página por URL: los filtros son signals, así que
 * cambiarlos recarga sin `subscribe` ni `| async`. El backend devuelve arrays
 * planos (sin `total`), por eso se pide `limit + 1` y se normaliza con
 * `normalizarPagina`.
 */
@Component({
  selector: 'sw-movimientos-listado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listado.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    PaginationComponent,
    SkeletonTableComponent,
    ProductoPickerComponent,
  ],
})
export class MovimientosListadoComponent {
  private readonly api = inject(ApiService);
  private readonly productos = inject(ProductosLookupService);
  private readonly ubicaciones = inject(UbicacionesLookupService);

  protected readonly store = inject(AuthStore);

  /** Filtros. */
  protected readonly tipo = signal<TipoFiltro>('');
  protected readonly productoId = signal<number | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly page = signal(0);

  protected readonly tipos = MOVIMIENTO_TIPOS;

  /**
   * El backend filtra por tipo y producto, no por fecha: el rango se aplica
   * sobre los movimientos de la página actual.
   */
  protected readonly datos = httpResource<Movimiento[]>(() => {
    const params: Record<string, string | number> = {
      skip: this.page() * PAGE_SIZE,
      limit: PAGE_SIZE + 1,
    };
    const tipo = this.tipo();
    if (tipo !== '') params['tipo'] = tipo;
    const producto = this.productoId();
    if (producto !== null) params['producto_id'] = producto;

    return { url: this.api.url('/movimientos/'), params };
  });

  private readonly cruda = computed(() => normalizarPagina(this.datos.value() ?? [], this.page(), PAGE_SIZE));

  /** Filas visibles: página actual + filtro local de fechas. */
  protected readonly filas = computed(() => {
    const items = this.cruda().items;
    const desde = this.desde();
    const hasta = this.hasta();
    if (!desde && !hasta) return items;

    return items.filter((m) => {
      const dia = m.fecha.slice(0, 10);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      return true;
    });
  });

  protected readonly rango = computed(() => rangoTexto(this.cruda()));
  protected readonly hayFiltros = computed(
    () => this.tipo() !== '' || this.productoId() !== null || !!this.desde() || !!this.hasta(),
  );

  constructor() {
    // Resuelve nombre de producto y códigos de ubicación de la página actual.
    // Ambos servicios cachean por id: cambiar de página no vuelve a pedir lo
    // que ya se conoce.
    effect(() => {
      const items = this.cruda().items;
      this.productos.asegurarVarios(items.map((m) => m.producto_id));
      this.ubicaciones.asegurarVarios(
        items.flatMap((m) => [m.ubicacion_origen_id, m.ubicacion_destino_id]),
      );
    });
  }

  // ── Filtros ──────────────────────────────────────────────────────────────

  protected onTipo(event: Event): void {
    this.tipo.set((event.target as HTMLSelectElement).value as TipoFiltro);
    this.page.set(0);
  }

  protected onProducto(productoId: number | null): void {
    this.productoId.set(productoId);
    this.page.set(0);
  }

  protected onDesde(event: Event): void {
    this.desde.set((event.target as HTMLInputElement).value);
    this.page.set(0);
  }

  protected onHasta(event: Event): void {
    this.hasta.set((event.target as HTMLInputElement).value);
    this.page.set(0);
  }

  protected limpiarFiltros(): void {
    this.tipo.set('');
    this.productoId.set(null);
    this.desde.set('');
    this.hasta.set('');
    this.page.set(0);
  }

  protected irA(page: number): void {
    this.page.set(Math.max(0, page));
  }

  // ── Celdas ───────────────────────────────────────────────────────────────

  protected readonly ETIQUETA_TIPO = ETIQUETA_TIPO;
  protected readonly TONE_TIPO = TONE_TIPO;

  protected producto(m: Movimiento): string {
    return (
      this.productos.etiquetaDe(m.producto_id) ??
      (m.producto_id === null ? 'Producto eliminado' : `#${m.producto_id}`)
    );
  }

  protected unidad(m: Movimiento): string | null {
    return this.productos.unidadDe(m.producto_id);
  }

  protected cantidad(m: Movimiento): string {
    return formatCantidad(m.cantidad, this.unidad(m));
  }

  protected origen(m: Movimiento): string {
    const id = m.ubicacion_origen_id;
    if (id === null) return '—';
    return this.ubicaciones.codigoDe(id) ?? `#${id}`;
  }

  protected destino(m: Movimiento): string {
    const id = m.ubicacion_destino_id;
    if (id === null) return '—';
    return this.ubicaciones.codigoDe(id) ?? `#${id}`;
  }

  /** El backend no devuelve el nombre del usuario: solo su id. */
  protected autor(m: Movimiento): string {
    const usuario = this.store.user();
    if (usuario && usuario.id === m.usuario_id) return usuario.nombre;
    return `Usuario #${m.usuario_id}`;
  }

  protected readonly fmt = {
    formatDateTime,
    formatRelative,
    formatNumber,
    formatCantidad,
  };
}

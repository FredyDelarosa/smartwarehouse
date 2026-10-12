import { httpResource } from '@angular/common/http';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { Incidencia } from '../../../core/models/incidencia.model';
import type { Producto } from '../../../core/models/producto.model';
import type { StockProducto } from '../../../core/models/inventario.model';
import { ApiService } from '../../../core/services/api.service';
import { CategoriasService } from '../../../core/services/categorias.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/store/auth.store';
import { formatDateTime, formatNumber } from '../../../core/utils/format';
import { BadgeComponent, TONE_POR_ESTADO, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { IndicatorCardComponent } from '../../../shared/components/indicator-card.component';
import { ModalComponent } from '../../../shared/components/modal.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { InventarioService } from '../../inventario/inventario.service';
import { ProductosService } from '../productos.service';

/** Cuántas incidencias mostramos como "últimas" (el endpoint pagina). */
const ULTIMAS_INCIDENCIAS = 5;

/**
 * Ficha de un producto: sus datos, su stock repartido y su historial reciente.
 *
 * Tres recursos independientes: si el historial de incidencias falla, el
 * stock y los datos del producto siguen siendo utilizables. En una vista de
 * consulta no tiene sentido tirar la pantalla entera por un bloque que no
 * carga.
 */
@Component({
  selector: 'sw-producto-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detalle.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    IndicatorCardComponent,
    ModalComponent,
    SkeletonTableComponent,
  ],
})
export class DetalleComponent {
  private readonly api = inject(ApiService);
  private readonly productos = inject(ProductosService);
  private readonly inventario = inject(InventarioService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly store = inject(AuthStore);
  private readonly categorias = inject(CategoriasService);

  /**
   * Nombre de la categoría, no el id.
   *
   * Si el backend aún no expone `/categorias` (ver DECISIONS.md "PET-1"), cae
   * en "Categoría #5": nunca se muestra un número pelado que el usuario no
   * pueda interpretar.
   */
  protected nombreCategoria(id: number | null | undefined): string | null {
    return this.categorias.nombreDe()(id ?? null);
  }

  /**
   * La foto apunta a un asset del backend que puede no existir. En cuanto el
   * `<img>` falla se muestra un marcador en lugar del icono de imagen rota.
   *
   * Se reinicia al cambiar de producto (navegar de `/productos/1` a
   * `/productos/2` reutiliza el componente y la foto nueva merece un intento
   * nuevo).
   */
  protected readonly fotoRota = signal(false);

  private fotoIntentadaPara: number | null = null;

  constructor() {
    this.categorias.cargar();

    afterRenderEffect(() => {
      const id = this.idNumero();
      if (id === null || id === this.fotoIntentadaPara) return;
      this.fotoIntentadaPara = id;
      this.fotoRota.set(false);
    });
  }

  /** Route param `:id`. */
  readonly id = input<string>();

  protected readonly idNumero = computed(() => {
    const bruto = this.id();
    if (bruto === undefined || bruto === null || bruto.trim() === '') return null;
    const n = Number(bruto);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  readonly producto = httpResource<Producto>(() => {
    const id = this.idNumero();
    return id === null ? undefined : this.api.url(`/productos/${id}`);
  });

  readonly stock = httpResource<StockProducto>(() => {
    const id = this.idNumero();
    return id === null ? undefined : this.api.url(`/inventario/producto/${id}`);
  });

  /**
   * Últimas incidencias del producto.
   *
   * Va contra `ApiService` directamente y no contra un `IncidenciasService`
   * porque aquí solo necesitamos el filtro `producto_id` ya resuelto: la
   * feature de incidencias no debe ser dependencia del catálogo.
   */
  readonly incidencias = httpResource<Incidencia[]>(() => {
    const id = this.idNumero();
    return id === null
      ? undefined
      : this.api.url('/incidencias/', { producto_id: id, limit: ULTIMAS_INCIDENCIAS });
  });

  protected readonly puedeEditar = computed(() => this.store.can('productos:editar'));
  protected readonly puedeEliminar = computed(() => this.store.can('productos:eliminar'));

  protected readonly bajaAbierta = signal(false);
  protected readonly dandoDeBaja = signal(false);

  protected readonly fmt = { formatNumber, formatDateTime };

  /** Totales del stock para las tarjetas: `null` mientras no ha llegado. */
  protected readonly stockTotal = computed(() => this.stock.value()?.stock_total ?? null);
  protected readonly stockUbicaciones = computed(
    () => this.stock.value()?.distribucion.length ?? null,
  );

  /** Ficha de stock del producto en Inventario. */
  protected readonly linkStock = computed(() => {
    const id = this.idNumero();
    return id === null ? null : ['/inventario', String(id)];
  });

  protected refrescar(): void {
    this.producto.reload();
    this.stock.reload();
    this.incidencias.reload();
  }

  protected abrirBaja(): void {
    this.bajaAbierta.set(true);
  }

  protected cancelarBaja(): void {
    this.bajaAbierta.set(false);
  }

  protected confirmarBaja(): void {
    const producto = this.producto.value();
    if (!producto || this.dandoDeBaja()) return;

    this.dandoDeBaja.set(true);
    this.productos.eliminar(producto.id).subscribe({
      next: () => {
        this.dandoDeBaja.set(false);
        this.bajaAbierta.set(false);
        this.notify.success(`Producto ${producto.codigo} dado de baja.`);
        this.inventario.limpiarCache();
        void this.router.navigate(['/productos']);
      },
      error: (err: unknown) => {
        this.dandoDeBaja.set(false);
        this.notify.apiError(err, 'No se pudo dar de baja el producto.');
      },
    });
  }

  protected tonoEstado(activo: boolean): BadgeTone {
    return activo ? TONE_POR_ESTADO.activo : TONE_POR_ESTADO.inactivo;
  }

  protected tonoIncidencia(i: Incidencia): BadgeTone {
    return i.resuelta ? TONE_POR_ESTADO.resuelto : TONE_POR_ESTADO.alerta;
  }

  protected etiquetaTipo(tipo: string): string {
    return tipo
      .split('_')
      .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
      .join(' ');
  }
}
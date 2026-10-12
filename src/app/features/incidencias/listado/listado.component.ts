import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { INCIDENCIA_TIPOS, type Incidencia, type IncidenciaTipo } from '../../../core/models/incidencia.model';
import { PAGE_SIZE } from '../../../core/models/paginacion.model';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/store/auth.store';
import { formatDateTime, formatRelative } from '../../../core/utils/format';
import { normalizarPagina, rangoTexto } from '../../../core/utils/paginacion';
import { BadgeComponent, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ModalComponent } from '../../../shared/components/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { ProductosLookupService } from '../../../shared/pickers/productos-lookup.service';
import { UbicacionesLookupService } from '../../../shared/pickers/ubicaciones-lookup.service';
import { IncidenciasService } from '../incidencias.service';

type TipoFiltro = IncidenciaTipo | '';
/** "todas" no se envía: es la ausencia de filtro. */
type EstadoFiltro = 'todas' | 'abiertas' | 'resueltas';

const ETIQUETA_TIPO: Record<IncidenciaTipo, string> = {
  MAL_UBICADO: 'Mal ubicado',
  FALTANTE: 'Faltante',
  DANADO: 'Dañado',
  OTRO: 'Otro',
};

/** Un color por tipo de incidencia. */
const TONE_TIPO: Record<IncidenciaTipo, BadgeTone> = {
  MAL_UBICADO: 'warning',
  FALTANTE: 'danger',
  DANADO: 'info',
  OTRO: 'neutral',
};

/** Explicación de cada tipo: se muestra en el reporte y como tooltip. */
const DESCRIPCION_TIPO: Record<IncidenciaTipo, string> = {
  MAL_UBICADO: 'El producto está, pero en una ubicación distinta a la registrada.',
  FALTANTE: 'La cantidad registrada no aparece en el estante.',
  DANADO: 'El producto está roto, mojado o con el empaque dañado.',
  OTRO: 'Cualquier otra situación que afecte al inventario.',
};

/**
 * Listado de incidencias: filtro por tipo, estado y rango de fechas.
 *
 * Resolver una incidencia es una acción irreversible (el backend solo pone
 * `resuelta = true`), así que va detrás de un `sw-modal` de confirmación.
 */
@Component({
  selector: 'sw-incidencias-listado',
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
export class IncidenciasListadoComponent {
  private readonly api = inject(ApiService);
  private readonly incidencias = inject(IncidenciasService);
  private readonly notify = inject(NotificationService);
  private readonly productos = inject(ProductosLookupService);
  private readonly ubicaciones = inject(UbicacionesLookupService);

  protected readonly store = inject(AuthStore);

  protected readonly tipos = INCIDENCIA_TIPOS;

  protected readonly tipo = signal<TipoFiltro>('');
  protected readonly estado = signal<EstadoFiltro>('todas');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly page = signal(0);

  protected readonly datos = httpResource<Incidencia[]>(() => {
    const params: Record<string, string | number | boolean> = {
      skip: this.page() * PAGE_SIZE,
      limit: PAGE_SIZE + 1,
    };
    const tipo = this.tipo();
    if (tipo !== '') params['tipo'] = tipo;
    if (this.estado() === 'abiertas') params['resuelta'] = false;
    if (this.estado() === 'resueltas') params['resuelta'] = true;
    if (this.desde() !== '') params['desde'] = this.desde();
    if (this.hasta() !== '') params['hasta'] = `${this.hasta()}T23:59:59`;

    return { url: this.api.url('/incidencias/'), params };
  });

  private readonly cruda = computed(() =>
    normalizarPagina(this.datos.value() ?? [], this.page(), PAGE_SIZE),
  );

  protected readonly filas = computed(() => this.cruda().items);
  protected readonly rango = computed(() => rangoTexto(this.cruda()));

  protected readonly abiertas = computed(() => this.filas().filter((i) => !i.resuelta).length);

  protected readonly hayFiltros = computed(
    () => this.tipo() !== '' || this.estado() !== 'todas' || !!this.desde() || !!this.hasta(),
  );

  // ── Modal de resolución ───────────────────────────────────────────────────

  /** Incidencia seleccionada en el modal (null = cerrado). */
  protected readonly pendiente = signal<Incidencia | null>(null);
  protected readonly confirmando = signal(false);

  constructor() {
    // Resuelve los productos y ubicaciones que aparecen en la página actual.
    effect(() => {
      const items = this.cruda().items;
      this.productos.asegurarVarios(items.map((i) => i.producto_id));
      this.ubicaciones.asegurarVarios(items.map((i) => i.ubicacion_id));
    });
  }

  // ── Filtros ──────────────────────────────────────────────────────────────

  protected onTipo(event: Event): void {
    this.tipo.set((event.target as HTMLSelectElement).value as TipoFiltro);
    this.page.set(0);
  }

  protected onEstado(event: Event): void {
    this.estado.set((event.target as HTMLSelectElement).value as EstadoFiltro);
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
    this.estado.set('todas');
    this.desde.set('');
    this.hasta.set('');
    this.page.set(0);
  }

  protected irA(page: number): void {
    this.page.set(Math.max(0, page));
  }

  // ── Resolución ───────────────────────────────────────────────────────────

  protected puedeResolver = computed(() => this.store.can('incidencias:resolver'));

  protected abrirResolver(incidencia: Incidencia): void {
    if (!this.puedeResolver() || incidencia.resuelta) return;
    this.pendiente.set(incidencia);
  }

  protected cerrarModal(): void {
    if (this.confirmando()) return;
    this.pendiente.set(null);
  }

  protected confirmar(): void {
    const incidencia = this.pendiente();
    if (!incidencia || this.confirmando()) return;

    this.confirmando.set(true);
    this.incidencias.resolver(incidencia.id).subscribe({
      next: () => {
        this.confirmando.set(false);
        this.pendiente.set(null);
        this.notify.success('Incidencia marcada como resuelta.');
        // Recargamos para que la fila refleje `resuelta` y `fecha_resolucion`.
        this.datos.reload();
      },
      error: (err: unknown) => {
        this.confirmando.set(false);
        this.notify.apiError(err, 'No se pudo resolver la incidencia.');
      },
    });
  }

  // ── Celdas ───────────────────────────────────────────────────────────────

  protected readonly ETIQUETA_TIPO = ETIQUETA_TIPO;
  protected readonly TONE_TIPO = TONE_TIPO;
  protected readonly DESCRIPCION_TIPO = DESCRIPCION_TIPO;

  protected producto(i: Incidencia): string | null {
    return this.productos.etiquetaDe(i.producto_id);
  }

  protected ubicacion(i: Incidencia): string | null {
    const id = i.ubicacion_id;
    if (id === null) return null;
    return this.ubicaciones.codigoDe(id) ?? `#${id}`;
  }

  protected readonly fmt = { formatDateTime, formatRelative };
}

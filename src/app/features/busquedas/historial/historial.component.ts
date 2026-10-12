import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';

import {
  normalizarBusqueda,
  type BusquedaHistorial,
  type BusquedaHistorialApi,
} from '../../../core/models/busqueda.model';
import { ApiService } from '../../../core/services/api.service';
import { formatDuration, formatRelative } from '../../../core/utils/format';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';

/**
 * Historial de búsquedas del usuario autenticado.
 *
 * Cada fila es una medición real de tiempo de localización: es la fuente de
 * datos de la comparativa "antes vs después" que pide el proyecto.
 */
@Component({
  selector: 'sw-historial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historial.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
  ],
})
export class HistorialComponent {
  private readonly api = inject(ApiService);

  /** Pedimos 100 filas: es un historial personal, cabe en dos pantallas. */
  private readonly datos = httpResource<BusquedaHistorialApi[]>(() =>
    this.api.url('/busquedas/historial', { skip: 0, limit: 100 }),
  );

  /** Filas ya normalizadas (el servidor manda `fecha_hora_inicio`, no `fecha`). */
  protected readonly filas = computed<BusquedaHistorial[]>(() =>
    (this.datos.value() ?? []).map(normalizarBusqueda),
  );

  /** Estadísticas locales para el resumen superior. */
  protected readonly resumen = computed(() => {
    const conTiempo = this.filas().filter((f) => f.tiempo_busqueda_segundos !== null);
    const total = conTiempo.length;
    const promedio = total
      ? conTiempo.reduce((a, f) => a + f.tiempo_busqueda_segundos!, 0) / total
      : 0;
    const exitosas = this.filas().filter((f) => f.exito).length;
    return {
      total: this.filas().length,
      promedio,
      exitosas,
      tasaExito: this.filas().length ? (exitosas / this.filas().length) * 100 : 0,
    };
  });

  protected readonly fmt = { formatDuration, formatRelative };

  protected refrescar(): void {
    this.datos.reload();
  }

  /** Color por tiempo: bajo = bien, alto = hay que optimizar. */
  protected tonoTiempo(segundos: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
    if (segundos === null) return 'neutral';
    if (segundos <= 120) return 'success';
    if (segundos <= 300) return 'warning';
    return 'danger';
  }
}
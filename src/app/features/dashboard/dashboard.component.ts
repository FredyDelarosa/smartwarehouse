import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { AlertaStock, DashboardResumen } from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../core/store/auth.store';
import { formatDecimal, formatDuration, formatNumber } from '../../core/utils/format';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { IconComponent } from '../../shared/components/icon.component';
import { IndicatorCardComponent } from '../../shared/components/indicator-card.component';
import { SkeletonCardsComponent } from '../../shared/components/skeleton-cards.component';
import { SkeletonTableComponent } from '../../shared/components/skeleton-table.component';

/**
 * Panel de control.
 *
 * Usa `httpResource` (Resource API de Angular 22): pide los datos por URL y
 * expone `isLoading()`, `error()` y `value()` como signals. Sin `subscribe`,
 * sin `| async`, sin riesgo de fuga de suscripciones.
 */
@Component({
  selector: 'sw-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  imports: [
    RouterLink,
    SkeletonCardsComponent,
    SkeletonTableComponent,
    IndicatorCardComponent,
    EmptyStateComponent,
    IconComponent,
  ],
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly store = inject(AuthStore);

  /** Los 6 KPIs de GET /metricas/dashboard. */
  readonly datos = httpResource<DashboardResumen>(() => this.api.url('/metricas/dashboard'));

  /** Alertas de stock: lo que el usuario debería atender primero. */
  readonly alertas = httpResource<AlertaStock[]>(() => this.api.url('/inventario/alertas'));

  protected readonly nombre = computed(() => this.store.user()?.nombre?.split(' ')[0] ?? '');

  protected readonly fmt = { formatNumber, formatDecimal, formatDuration };

  /** Recarga los recursos (p. ej. tras volver de registrar movimientos). */
  protected recargar(): void {
    this.datos.reload();
    this.alertas.reload();
  }
}
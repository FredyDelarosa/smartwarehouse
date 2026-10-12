import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { AlertaStock } from '../../../core/models/inventario.model';
import { ApiService } from '../../../core/services/api.service';
import { formatNumber, formatPercent } from '../../../core/utils/format';
import { BadgeComponent, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { IndicatorCardComponent } from '../../../shared/components/indicator-card.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';

/** Severidad de una alerta: qué tan lejos está de su stock mínimo. */
type Criticidad = { tone: BadgeTone; etiqueta: string };

/**
 * Vista por defecto de Inventario: productos bajo su stock mínimo.
 *
 * El backend ya devuelve las alertas ordenadas por faltante, pero las
 * reordenamos aquí porque el listado es la pantalla de trabajo: quien entra
 * necesita ver primero lo que más falta, y no queremos depender de que el
 * orden del servidor se mantenga.
 *
 * "Bajo mínimo" no significa lo mismo para todos: un producto al 40 % de su
 * mínimo es una emergencia y otro al 88 % apenas está para reponer. De ahí
 * el badge de criticidad y la barra de cobertura en cada fila — el color
 * nunca es el único portador de información, siempre acompaña a un texto.
 */
@Component({
  selector: 'sw-alertas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alertas.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    IndicatorCardComponent,
    SkeletonTableComponent,
  ],
})
export class AlertasComponent {
  private readonly api = inject(ApiService);

  readonly alertas = httpResource<AlertaStock[]>(() => this.api.url('/inventario/alertas'));

  /** Ordenadas de más a menos faltante: lo urgente arriba. */
  protected readonly lista = computed(() =>
    [...(this.alertas.value() ?? [])].sort((a, b) => b.faltante - a.faltante),
  );

  protected readonly resumen = computed(() => {
    const items = this.lista();
    const faltanteTotal = items.reduce((acc, a) => acc + a.faltante, 0);
    const minimoTotal = items.reduce((acc, a) => acc + a.stock_minimo, 0);
    const stockTotal = items.reduce((acc, a) => acc + a.stock_total, 0);
    return {
      productos: items.length,
      faltanteTotal,
      // Cobertura global: cuánto del mínimo acumulado hay hoy en almacén.
      cobertura: minimoTotal > 0 ? (stockTotal / minimoTotal) * 100 : 0,
      critico: items[0] ?? null,
      agotados: items.filter((a) => a.stock_total <= 0).length,
    };
  });

  protected readonly fmt = { formatNumber, formatPercent };

  /** Placeholders de carga de las tarjetas de resumen. */
  protected readonly skeleton = [0, 1, 2, 3];

  /** Destino de la tarjeta del producto más crítico (`null` si no hay). */
  protected readonly linkCritico = computed(() => {
    const critico = this.resumen().critico;
    return critico ? ['/productos', String(critico.producto_id)] : null;
  });

  protected refrescar(): void {
    this.alertas.reload();
  }

  /** % del stock mínimo cubierto (0–100). Alimenta la barra de la fila. */
  protected cobertura(a: AlertaStock): number {
    if (a.stock_minimo <= 0) return 100;
    return Math.max(0, Math.min(100, (a.stock_total / a.stock_minimo) * 100));
  }

  protected criticidad(a: AlertaStock): Criticidad {
    if (a.stock_total <= 0) return { tone: 'danger', etiqueta: 'Agotado' };
    const ratio = this.cobertura(a);
    if (ratio < 50) return { tone: 'danger', etiqueta: 'Crítico' };
    if (ratio < 90) return { tone: 'warning', etiqueta: 'Bajo' };
    return { tone: 'warning', etiqueta: 'Al límite' };
  }

  protected tonoBarra(a: AlertaStock): string {
    return this.cobertura(a) < 50 ? 'bg-danger' : 'bg-warning';
  }
}
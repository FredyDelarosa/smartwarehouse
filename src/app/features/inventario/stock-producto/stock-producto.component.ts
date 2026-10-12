import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DistribucionStock, StockProducto } from '../../../core/models/inventario.model';
import { ApiService } from '../../../core/services/api.service';
import { formatNumber, formatPercent } from '../../../core/utils/format';
import { BadgeComponent, type BadgeTone } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { IndicatorCardComponent } from '../../../shared/components/indicator-card.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';

/**
 * Stock consolidado de un producto: cuánto hay y dónde.
 *
 * La ruta es `/inventario/:productoId`; el id llega como input thanks a
 * `withComponentInputBinding()` (ver app.config.ts), sin leer el
 * ActivatedRoute a mano.
 *
 * La distribución se dibuja con barras construidas con `div`s: para un
 * handful de ubicaciones, una librería de gráficos no compensa, y así las
 * barras heredan los tokens del tema (incluido el modo oscuro) gratis.
 */
@Component({
  selector: 'sw-stock-producto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-producto.component.html',
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
export class StockProductoComponent {
  private readonly api = inject(ApiService);

  /** Route param `:productoId`. */
  readonly productoId = input<string>();

  /** Id ya validado: si la URL trae algo que no es un número, no hay petición. */
  protected readonly idNumero = computed(() => {
    const bruto = this.productoId();
    if (bruto === undefined || bruto === null || bruto.trim() === '') return null;
    const n = Number(bruto);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  readonly stock = httpResource<StockProducto>(() => {
    const id = this.idNumero();
    return id === null ? undefined : this.api.url(`/inventario/producto/${id}`);
  });

  /** Mayor cantidad de la distribución: es la que llena la barra al 100 %. */
  protected readonly maxCantidad = computed(() =>
    Math.max(1, ...this.distribucion().map((d) => d.cantidad)),
  );

  /** De más a menos: primero la ubicación donde más hay que ir a buscar. */
  protected readonly distribucion = computed(() =>
    [...(this.stock.value()?.distribucion ?? [])].sort((a, b) => b.cantidad - a.cantidad),
  );

  /** % del stock mínimo cubierto (puede pasar de 100 si hay excedente). */
  protected readonly cobertura = computed(() => {
    const s = this.stock.value();
    if (!s || s.stock_minimo <= 0) return 0;
    return (s.stock_total / s.stock_minimo) * 100;
  });

  protected readonly fmt = { formatNumber, formatPercent };

  protected refrescar(): void {
    this.stock.reload();
  }

  /** Ancho de la barra de una ubicación, en % del máximo de la lista. */
  protected ancho(d: DistribucionStock): number {
    return Math.max(3, Math.round((d.cantidad / this.maxCantidad()) * 100));
  }

  /** % del total del producto que hay en esa ubicación. */
  protected porcentajeTotal(d: DistribucionStock): number {
    const total = this.stock.value()?.stock_total ?? 0;
    return total > 0 ? (d.cantidad / total) * 100 : 0;
  }

  protected tonoEstado(requiereAlerta: boolean): BadgeTone {
    return requiereAlerta ? 'danger' : 'success';
  }
}
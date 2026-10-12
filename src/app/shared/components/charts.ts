import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, type IconName } from './icon.component';

/**
 * Gráficos en SVG puro — sin Chart.js ni ng2-charts.
 *
 * Motivo: el proyecto necesita 3 visualizaciones (barras comparadas, donut y
 * lista de barras). `chart.js` pesa ~200 kB y habría que configurarlo aparte
 * para que respetara el design system.
 *
 * Todos son responsivos con `viewBox`, accesibles (`role="img"` + `<title>`),
 * y temáticos: usan variables CSS del design system, nunca colores fijos.
 *
 * NOTA: el backend solo expone `GET /metricas/comparativa` (dos periodos) y
 * `tiempo-promedio` (un rango). NO hay un endpoint de serie temporal, así que
 * no existe un gráfico de línea por meses. Ver DECISIONS.md §3.7.
 */

/** Una serie de la comparativa antes/después. */
export type SerieBarra = {
  etiqueta: string;
  valor: number;
  /** Color de la barra; si se omite se calcula por posición. */
  color?: string;
};

@Component({
  selector: 'sw-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="w-full">
      <figcaption class="sr-only-focusable">{{ descripcion() }}</figcaption>

      <div class="flex items-end justify-center gap-6" [style.height.px]="alto()">
        @for (s of series(); track s.etiqueta; let i = $index) {
          <div class="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span class="sw-tabular text-sm font-semibold text-foreground">
              {{ formato(s.valor) }}
            </span>
            <div
              class="w-full max-w-16 rounded-t-md transition-[height] duration-300 ease-out"
              [style.height.%]="porcentaje(s.valor)"
              [style.background-color]="s.color ?? colorPorDefecto(i)"
              [attr.title]="s.etiqueta + ': ' + formato(s.valor)"
            ></div>
            <span class="text-xs leading-tight text-muted-foreground">{{ s.etiqueta }}</span>
          </div>
        }
      </div>
    </figure>
  `,
})
export class BarChartComponent {
  readonly series = input.required<SerieBarra[]>();
  readonly alto = input<number>(140);
  readonly descripcion = input<string>('Gráfico de barras comparativo');
  readonly sufijo = input<string>('');

  /** Escala común: la barra más alta ocupa el 100 % del alto. */
  private readonly maximo = computed(() => Math.max(...this.series().map((s) => s.valor), 1));

  protected porcentaje(valor: number): number {
    // Mínimo 2 %: un valor muy pequeño sigue siendo visible.
    return Math.max(2, (valor / this.maximo()) * 100);
  }

  protected formato(valor: number): string {
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + this.sufijo();
  }

  /** Por defecto: el "antes" en neutro, el "después" en verde acento. */
  protected colorPorDefecto(index: number): string {
    return index === 0 ? 'var(--color-border-strong)' : 'var(--color-accent)';
  }
}

/** Segmento de un donut. */
export type SegmentoDonut = {
  etiqueta: string;
  valor: number;
  color: string;
};

/** Arco ya calculado: segmento + atributos de `stroke-dasharray`. */
type Arco = SegmentoDonut & { dasharray: string; offset: string };

@Component({
  selector: 'sw-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 100 100"
        class="size-32 shrink-0 -rotate-90"
        role="img"
        [attr.aria-label]="descripcion()"
      >
        <circle
          cx="50" cy="50" r="38"
          fill="none"
          stroke="var(--color-surface-sunken)"
          stroke-width="14"
        />
        @for (a of arcos(); track a.etiqueta) {
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            [attr.stroke]="a.color"
            [attr.stroke-dasharray]="a.dasharray"
            [attr.stroke-dashoffset]="a.offset"
            stroke-width="14"
          >
            <title>{{ a.etiqueta }}: {{ a.valor }}</title>
          </circle>
        }
      </svg>

      <figcaption class="min-w-0 flex-1">
        <ul class="space-y-2">
          @for (s of segmentos(); track s.etiqueta) {
            <li class="flex items-center gap-2.5 text-sm">
              <span
                class="size-2.5 shrink-0 rounded-full"
                [style.background-color]="s.color"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1 truncate text-foreground">{{ s.etiqueta }}</span>
              <span class="sw-tabular font-semibold text-foreground">{{ s.valor }}</span>
              <span class="sw-tabular w-11 text-right text-xs text-muted-foreground">
                {{ porcentaje(s.valor) }}
              </span>
            </li>
          }
        </ul>
      </figcaption>
    </figure>
  `,
})
export class DonutChartComponent {
  readonly segmentos = input.required<SegmentoDonut[]>();
  readonly descripcion = input<string>('Distribución por categoría');

  private readonly total = computed(() =>
    Math.max(
      this.segmentos().reduce((a, s) => a + s.valor, 0),
      1,
    ),
  );

  /** Circunferencia de un círculo de r=38 en el viewBox 0 0 100 100. */
  private readonly circunferencia = 2 * Math.PI * 38;

  /** Cada arco recorta el anterior con `stroke-dasharray`. */
  protected arcos(): Arco[] {
    let acumulado = 0;
    return this.segmentos().map((s) => {
      const largo = (s.valor / this.total()) * this.circunferencia;
      const arco: Arco = {
        ...s,
        dasharray: `${largo.toFixed(2)} ${this.circunferencia.toFixed(2)}`,
        offset: (-acumulado).toFixed(2),
      };
      acumulado += largo;
      return arco;
    });
  }

  protected porcentaje(valor: number): string {
    return ((valor / this.total()) * 100).toFixed(0) + '%';
  }
}

/** Fila de una barra horizontal (top de productos, movimientos por tipo). */
export type FilaBarra = {
  etiqueta: string;
  valor: number;
  color?: string;
};

@Component({
  selector: 'sw-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-3">
      @for (item of items(); track item.etiqueta) {
        <li>
          <div class="mb-1 flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate text-sm text-foreground">{{ item.etiqueta }}</span>
            <span class="sw-tabular shrink-0 text-xs font-medium text-muted-foreground">
              {{ formato(item.valor) }}
            </span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              [style.width.%]="porcentaje(item.valor)"
              [style.background-color]="item.color ?? 'var(--color-accent)'"
            ></div>
          </div>
        </li>
      }
    </ul>
  `,
})
export class BarListComponent {
  readonly items = input.required<FilaBarra[]>();
  readonly sufijo = input<string>('');

  private readonly max = computed(() => Math.max(...this.items().map((i) => i.valor), 1));

  protected porcentaje(valor: number): number {
    return Math.max(1, (valor / this.max()) * 100);
  }

  protected formato(valor: number): string {
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + this.sufijo();
  }
}

/**
 * Distintivo de mejora destacada ("↓ 84 %").
 *
 * La flecha es junto al porcentaje, no un color: el significado no depende
 * solo del matiz verde.
 */
@Component({
  selector: 'sw-mejora-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mostrar()) {
      <div
        class="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success-surface px-3 py-1.5 text-sm font-semibold text-success"
      >
        <sw-icon name="flecha-abajo" [size]="16" [strokeWidth]="2.5" />
        {{ porcentaje() }}
      </div>
    }
  `,
  imports: [IconComponent],
})
export class MejoraBadgeComponent {
  readonly porcentaje = input.required<string>();
  /** false cuando un periodo no tiene datos y el % no sería representativo. */
  readonly mostrar = input<boolean>(true);
}
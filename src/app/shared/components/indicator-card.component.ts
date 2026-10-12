import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent, type IconName } from './icon.component';

/**
 * Tarjeta de indicador (KPI) del panel y del detalle de producto.
 *
 * El valor es el elemento dominante: número grande, tabular, con la
 * unidad en tamaño secundario. El icono y la etiqueta contextualizan sin
 * competir con el dato.
 */
@Component({
  selector: 'sw-indicator-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="cardClasses()"
      [attr.aria-label]="ariaLabel()"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="sw-eyebrow">{{ label() }}</p>
        @if (icon(); as ico) {
          <span
            [class]="iconClasses()"
            aria-hidden="true"
          >
            <sw-icon [name]="ico" [size]="16" />
          </span>
        }
      </div>

      <p class="mt-2 flex items-baseline gap-1.5">
        <span
          class="sw-tabular text-2xl font-semibold leading-none tracking-tight"
          [class]="valueClasses()"
        >
          {{ value() }}
        </span>
        @if (unit()) {
          <span class="text-sm font-medium text-muted-foreground">{{ unit() }}</span>
        }
      </p>

      @if (hint(); as texto) {
        <p class="mt-2 text-xs leading-snug text-muted-foreground">{{ texto }}</p>
      }

      @if (action(); as etiqueta) {
        <a
          [routerLink]="link()"
          class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
        >
          {{ etiqueta }}
          <sw-icon name="flecha-derecha" [size]="13" />
        </a>
      }
    </div>
  `,
  imports: [IconComponent, RouterLink],
})
export class IndicatorCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number>('—');
  readonly unit = input<string>('');
  readonly hint = input<string>('');
  readonly icon = input<IconName | null>(null);
  readonly tone = input<'neutral' | 'info' | 'success' | 'warning' | 'danger'>('neutral');
  /** Texto de la acción opcional. Requiere `link`. */
  readonly action = input<string | null>(null);
  /** Destino de la acción opcional (routerLink). */
  readonly link = input<string | string[] | null>(null);

  protected readonly ariaLabel = computed(() => `${this.label()}: ${this.value()} ${this.unit()}`.trim());

  protected cardClasses(): string {
    return ['sw-card p-4 transition-shadow', 'hover:shadow-raised'].join(' ');
  }

  protected valueClasses(): string {
    const tones = {
      neutral: 'text-foreground',
      info: 'text-info',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
    } as const;
    return tones[this.tone()];
  }

  protected iconClasses(): string {
    const tones = {
      neutral: 'bg-surface-sunken text-muted-foreground',
      info: 'bg-info-surface text-info',
      success: 'bg-success-surface text-success',
      warning: 'bg-warning-surface text-warning',
      danger: 'bg-danger-surface text-danger',
    } as const;
    return ['flex size-7 shrink-0 items-center justify-center rounded-md', tones[this.tone()]].join(' ');
  }
}
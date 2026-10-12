import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Filas de esqueleto para tablas densas.
 *
 * Cada columna tiene un retardo de animación distinto: el resultado parece
 * un "barrido" de carga en lugar de parpadear todo a la vez.
 */
@Component({
  selector: 'sw-skeleton-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3 p-4" role="status" [attr.aria-label]="label()">
      @for (i of items(); track i) {
        <div class="flex items-center gap-3">
          @for (col of columnas(); track $index) {
            <div
              class="h-4 animate-pulse rounded bg-surface-sunken"
              [style.width]="col"
              [style.animation-delay.ms]="i * 60 + $index * 25"
            ></div>
          }
        </div>
      }
      <span class="sr-only-focusable">{{ label() }}</span>
    </div>
  `,
})
export class SkeletonTableComponent {
  readonly filas = input<number>(5);
  readonly columnas = input<string[]>(['2.5rem', '30%', '18%', '14%', '14%']);
  readonly label = input<string>('Cargando datos');

  protected readonly items = computed(() => Array.from({ length: this.filas() }, (_, i) => i));
}
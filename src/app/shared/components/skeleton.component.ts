import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder de carga con la misma caja que el contenido real.
 *
 * Evita el salto de layout cuando los datos llegan (CLS ≈ 0), que en un
 * terminal de almacén con red móvil lenta se nota muchísimo.
 */
@Component({
  selector: 'sw-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="animate-pulse rounded bg-surface-sunken"
      [style.height]="height()"
      [style.width]="width()"
      aria-hidden="true"
    ></div>
    @if (label()) {
      <span class="sr-only-focusable">{{ label() }}</span>
    }
  `,
})
export class SkeletonComponent {
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly label = input<string>('Cargando…');
}
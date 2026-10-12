import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Esqueleto de tarjetas KPI (dashboard, detalle de producto).
 * Replica el `grid` real para no mover nada cuando llegan los datos.
 */
@Component({
  selector: 'sw-skeleton-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4" [style.gridTemplateColumns]="gridTemplate()" role="status" [attr.aria-label]="label()">
      @for (i of items(); track i) {
        <div class="sw-card p-4">
          <div class="h-3 w-20 animate-pulse rounded bg-surface-sunken"></div>
          <div class="mt-3 h-7 w-16 animate-pulse rounded bg-surface-sunken"></div>
        </div>
      }
      <span class="sr-only-focusable">{{ label() }}</span>
    </div>
  `,
})
export class SkeletonCardsComponent {
  readonly cantidad = input<number>(6);
  readonly minWidth = input<string>('10rem');
  readonly label = input<string>('Cargando indicadores');

  protected readonly items = computed(() => Array.from({ length: this.cantidad() }, (_, i) => i));

  /** Se construye por concatenación: los backticks anidados romperían el template. */
  protected readonly gridTemplate = computed(
    () => 'repeat(auto-fit, minmax(' + this.minWidth() + ', 1fr))'.replace('))', ')'),
  );
}
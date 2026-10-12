import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from './icon.component';

/**
 * Pie de paginación para listados densos.
 *
 * El backend devuelve arrays planos sin `total`, así que el padre ya sabe
 * si hay página siguiente (`hasNext`); aquí solo se navega.
 * Usa botones (<>) en vez de un <select>: es lo esperado en escritorio y
 * navegable con teclado sin sorcería.
 */
@Component({
  selector: 'sw-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <nav
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5"
        aria-label="Paginación"
      >
        <p class="sw-tabular text-xs text-muted-foreground">
          {{ rango() }}
        </p>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="prev.emit()"
            [disabled]="!hasPrev()"
            class="inline-flex items-center gap-1 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
            aria-label="Página anterior"
          >
            <sw-icon name="flecha-izquierda" [size]="14" />
            Anterior
          </button>

          <span class="sw-tabular px-2 text-xs font-medium text-muted-foreground">
            {{ page() + 1 }}
          </span>

          <button
            type="button"
            (click)="next.emit()"
            [disabled]="!hasNext()"
            class="inline-flex items-center gap-1 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
            aria-label="Página siguiente"
          >
            Siguiente
            <sw-icon name="flecha-derecha" [size]="14" />
          </button>
        </div>
      </nav>
    }
  `,
  imports: [IconComponent],
})
export class PaginationComponent {
  /** Texto del rango, calculado por el padre (p.ej. "1–20 de más…"). */
  readonly rango = input.required<string>();
  /** Página actual 0-based. */
  readonly page = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);
  readonly total = input<number>(0);

  readonly prev = output<void>();
  readonly next = output<void>();
}
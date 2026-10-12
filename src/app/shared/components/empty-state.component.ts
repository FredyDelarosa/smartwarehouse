import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, type IconName } from './icon.component';

/**
 * Estados vacíos / de carga / de error.
 *
 * Una app de almacén muestra esto constantemente (cero alertas, cero
 * movimientos hoy, búsqueda sin resultados). Un mensaje útil dice QUÉ
 * hacer a continuación, no solo "no hay datos".
 */
@Component({
  selector: 'sw-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
      @if (icon(); as ico) {
        <div
          class="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-sunken text-subtle-foreground"
          aria-hidden="true"
        >
          <sw-icon [name]="icon()!" [size]="24" />
        </div>
      }

      <p class="text-sm font-semibold text-foreground">{{ title() }}</p>

      @if (description()) {
        <p class="mt-1 max-w-sm text-sm text-muted-foreground">{{ description() }}</p>
      }

      @if (action()) {
        <div class="mt-5">
          <ng-content />
        </div>
      }
    </div>
  `,
  imports: [IconComponent],
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('vacio');
  readonly title = input<string>('Sin datos');
  readonly description = input<string>('');
  /** Si es true se proyecta <ng-content> (el botón de acción). */
  readonly action = input<boolean>(false);
}
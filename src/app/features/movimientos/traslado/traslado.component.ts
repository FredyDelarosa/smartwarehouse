import { ChangeDetectionStrategy, Component } from '@angular/core';

import { MovimientoFormComponent } from '../shared/movimiento-form.component';

/**
 * `/movimientos/traslado`
 *
 * Pide origen y destino, y el formulario común valida que no sean la misma
 * ubicación.
 *
 * Binding y no atributo estático: `input.required()` + atributo estático
 * dispara NG0950 en el primer ciclo de detección.
 */
@Component({
  selector: 'sw-movimiento-traslado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<sw-movimiento-form [tipo]="TIPO" />`,
  imports: [MovimientoFormComponent],
})
export class TrasladoComponent {
  protected readonly TIPO = 'TRASLADO' as const;
}

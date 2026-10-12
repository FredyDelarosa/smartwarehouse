import { ChangeDetectionStrategy, Component } from '@angular/core';

import { MovimientoFormComponent } from '../shared/movimiento-form.component';

/**
 * `/movimientos/entrada`
 *
 * Solo aporta el tipo: el formulario común decide qué campos pintar
 * (producto, cantidad y ubicación de destino) y qué endpoint llamar.
 *
 * OJO: se usa `[tipo]="TIPO"` (binding) y no `tipo="ENTRADA"` (atributo
 * estático). Con un `input.required()` el atributo estático puede no estar
 * disponible todavía en el primer ciclo de detección y Angular lanza NG0950.
 */
@Component({
  selector: 'sw-movimiento-entrada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<sw-movimiento-form [tipo]="TIPO" />`,
  imports: [MovimientoFormComponent],
})
export class EntradaComponent {
  protected readonly TIPO = 'ENTRADA' as const;
}

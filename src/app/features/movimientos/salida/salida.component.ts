import { ChangeDetectionStrategy, Component } from '@angular/core';

import { MovimientoFormComponent } from '../shared/movimiento-form.component';

/**
 * `/movimientos/salida`
 *
 * Pide ubicación de origen; un 409 STOCK_INSUFICIENTE del backend se muestra
 * con su propio mensaje.
 *
 * Binding y no atributo estático: `input.required()` + atributo estático
 * dispara NG0950 en el primer ciclo de detección.
 */
@Component({
  selector: 'sw-movimiento-salida',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<sw-movimiento-form [tipo]="TIPO" />`,
  imports: [MovimientoFormComponent],
})
export class SalidaComponent {
  protected readonly TIPO = 'SALIDA' as const;
}

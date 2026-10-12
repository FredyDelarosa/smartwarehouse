import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormField,
  form,
  maxLength,
  min,
  required,
  submit,
  validate,
  type Field,
} from '@angular/forms/signals';

import { ApiError } from '../../../core/models/error.model';
import type { MovimientoRequest } from '../../../core/models/movimiento.model';
import { NotificationService } from '../../../core/services/notification.service';
import { formatCantidad } from '../../../core/utils/format';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent, type IconName } from '../../../shared/components/icon.component';
import { ProductoPickerComponent } from '../../../shared/pickers/producto-picker.component';
import { ProductosLookupService } from '../../../shared/pickers/productos-lookup.service';
import { UbicacionPickerComponent } from '../../../shared/pickers/ubicacion-picker.component';
import { MovimientosService } from '../movimientos.service';

/** Los tres tipos que se registran desde la UI (AJUSTE es interno del backend). */
export type MovimientoTipoFormulario = 'ENTRADA' | 'SALIDA' | 'TRASLADO';

type MovimientoFormModel = {
  producto_id: number | null;
  cantidad: number | null;
  referencia: string;
  observaciones: string;
  ubicacion_origen_id: number | null;
  ubicacion_destino_id: number | null;
};

const ETIQUETA: Record<MovimientoTipoFormulario, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
};

const ICONO: Record<MovimientoTipoFormulario, IconName> = {
  ENTRADA: 'flecha-abajo',
  SALIDA: 'flecha-derecha',
  TRASLADO: 'movimiento',
};

/** Copy de cada formulario: qué pasa con el stock y qué hay que tener en cuenta. */
const COPY: Record<
  MovimientoTipoFormulario,
  { titulo: string; resumen: string; ayuda: string; exito: string }
> = {
  ENTRADA: {
    titulo: 'Registrar entrada',
    resumen: 'Suma existencias: el producto entra al almacén y se guarda en una ubicación.',
    ayuda: 'Indica la orden de compra o el albarán como referencia para poder auditar el ingreso.',
    exito: 'Entrada registrada.',
  },
  SALIDA: {
    titulo: 'Registrar salida',
    resumen: 'Resta existencias: el producto sale del almacén desde una ubicación.',
    ayuda:
      'Si el backend responde que no hay stock suficiente, ajusta la cantidad o revisa el inventario antes de reintentar.',
    exito: 'Salida registrada.',
  },
  TRASLADO: {
    titulo: 'Registrar traslado',
    resumen: 'Mueve el producto de una ubicación a otra sin alterar el total del almacén.',
    ayuda: 'Origen y destino deben ser distintos: un traslado a la misma ubicación no cambia nada.',
    exito: 'Traslado registrado.',
  },
};

/**
 * Formulario común de los tres tipos de movimiento.
 *
 * Cada ruta (`/movimientos/entrada|salida|traslado`) monta este componente
 * con un `tipo` distinto; los campos que no aplican se ocultan y no se
 * validan. Así el comportamiento (validación, 409, navegación tras éxito) está
 * escrito una sola vez.
 *
 * Formulario de Signal Forms (`@angular/forms/signals`): nada de FormGroup.
 */
@Component({
  selector: 'sw-movimiento-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-form.component.html',
  imports: [
    // `FormField` es la directiva que hace funcionar `[formField]`: sin ella
    // el template no reconoce el binding en <input>, <textarea> ni en los
    // controles personalizados (los pickers).
    FormField,
    ButtonComponent,
    IconComponent,
    ProductoPickerComponent,
    UbicacionPickerComponent,
  ],
})
export class MovimientoFormComponent {
  /** Tipo de movimiento: determina qué campos se piden y qué endpoint se usa. */
  readonly tipo = input.required<MovimientoTipoFormulario>();

  private readonly movimientos = inject(MovimientosService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly productos = inject(ProductosLookupService);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  /** Aviso de submit cuando falta una ubicación que el schema no exige. */
  protected readonly faltante = signal<string | null>(null);

  private readonly model = signal<MovimientoFormModel>({
    producto_id: null,
    cantidad: null,
    referencia: '',
    observaciones: '',
    ubicacion_origen_id: null,
    ubicacion_destino_id: null,
  });

  /**
   * El schema NO puede leer `this.tipo()` aquí: este inicializador corre en el
   * constructor, antes de que Angular asigne el input, y `input.required()`
   * lanza NG0950.
   *
   * La solución es un `apply` diferido: se registra una segunda pasada de
   * validación que ya sí puede leer `tipo`, porque se ejecuta cuando el
   * formulario se construye (tras asignar los inputs).
   *
   * Para condicionar qué campos se piden, `pideOrigen`/`pideDestino` controlan
   * además la visibilidad: un campo oculto y no requerido no debería validar.
   */
  readonly form = form(this.model, (f) => {
    required(f.producto_id, { message: 'Selecciona el producto que se mueve.' });
    required(f.cantidad, { message: 'Indica cuántas unidades se mueven.' });
    min(f.cantidad, 1, { message: 'La cantidad debe ser mayor que cero.' });
    maxLength(f.referencia, 60, { message: 'La referencia es demasiado larga (máx. 60).' });
    maxLength(f.observaciones, 500, { message: 'Las observaciones son demasiado largas (máx. 500).' });

    // Traslado: el origen y el destino tienen que ser distintos.
    validate(f.ubicacion_origen_id, (ctx) => {
      const origen = ctx.value();
      const destino = ctx.valueOf(f.ubicacion_destino_id);
      if (origen !== null && destino !== null && origen === destino) {
        return {
          kind: 'MISMA_UBICACION',
          message: 'El origen y el destino deben ser ubicaciones distintas.',
        };
      }
      return undefined;
    });
  });

  // ── Presentación ─────────────────────────────────────────────────────────

  protected readonly etiqueta = computed(() => ETIQUETA[this.tipo()]);
  protected readonly icono = computed(() => ICONO[this.tipo()]);
  protected readonly titulo = computed(() => COPY[this.tipo()].titulo);
  protected readonly resumen = computed(() => COPY[this.tipo()].resumen);
  protected readonly ayuda = computed(() => COPY[this.tipo()].ayuda);
  protected readonly exito = computed(() => COPY[this.tipo()].exito);

  protected readonly pideOrigen = computed(() => this.tipo() !== 'ENTRADA');
  protected readonly pideDestino = computed(() => this.tipo() !== 'SALIDA');

  /** Unidad de medida del producto elegido, para leer "50 piezas" de un vistazo. */
  protected readonly unidad = computed(() => this.productos.unidadDe(this.model().producto_id));

  /** Cantidad tal y como está en el modelo (null si aún no se ha escrito). */
  protected readonly cantidadActual = computed(() => this.model().cantidad);

  protected readonly cantidadLegible = computed(() =>
    formatCantidad(this.cantidadActual(), this.unidad()),
  );

  // ── Acciones ─────────────────────────────────────────────────────────────

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorServidor.set(null);

    // `tipo()` solo es válido aquí (ya no estamos en el constructor), así que
    // es el momento de exigir la ubicación que el tipo necesita. Si no, el
    // backend respondería 422 con un mensaje que el usuario no entiende.
    if (!this.ubicacionesValidas()) return;

    void submit(this.form, async () => this.enviar());
  }

  /** Marca como tocado y avisa si falta la ubicación que exige este tipo. */
  private ubicacionesValidas(): boolean {
    const m = this.model();

    if (this.pideOrigen() && m.ubicacion_origen_id === null) {
      this.faltante.set('Selecciona la ubicación de origen.');
      this.form.ubicacion_origen_id().markAsTouched();
      return false;
    }
    if (this.pideDestino() && m.ubicacion_destino_id === null) {
      this.faltante.set('Selecciona la ubicación de destino.');
      this.form.ubicacion_destino_id().markAsTouched();
      return false;
    }

    this.faltante.set(null);
    return true;
  }

  protected cancelar(): void {
    void this.router.navigate(['/movimientos']);
  }

  /** Mensaje de validación de un campo, si ya se tocó. */
  protected errorDe(campo: Field<number | null> | Field<string>): string | null {
    const estado = campo();
    if (!estado.touched() || !estado.invalid()) return null;
    return estado.errors()[0]?.message ?? 'Valor inválido.';
  }

  /** Mensaje mostrado junto a un campo de ubicación que falta. */
  protected errorUbicacion(campo: Field<number | null>): string | null {
    const estado = campo();
    if (estado.touched() && estado.invalid()) {
      return estado.errors()[0]?.message ?? 'Valor inválido.';
    }
    if (estado.touched() && this.model()[campo === this.form.ubicacion_origen_id ? 'ubicacion_origen_id' : 'ubicacion_destino_id'] === null) {
      return this.faltante();
    }
    return null;
  }

  private enviar(): void {
    const tipo = this.tipo();
    const payload = this.construirPayload(tipo);

    this.enviando.set(true);
    this.movimientos.registrar(payload).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notify.success(this.exito());
        void this.router.navigate(['/movimientos']);
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        const mensaje =
          err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento.';

        // 409 STOCK_INSUFICIENTE: el backend ya explica qué falta y cuánto hay.
        // Se muestra tal cual (toast + aviso inline) en vez de un texto genérico.
        if (err instanceof ApiError && err.errorCode === 'STOCK_INSUFICIENTE') {
          this.errorServidor.set(mensaje);
          this.notify.error(mensaje);
          return;
        }
        this.errorServidor.set(mensaje);
        this.notify.apiError(err, 'No se pudo registrar el movimiento.');
      },
    });
  }

  private construirPayload(tipo: MovimientoTipoFormulario): MovimientoRequest {
    const m = this.model();
    const base = {
      producto_id: m.producto_id!,
      cantidad: m.cantidad!,
      referencia: m.referencia.trim() || null,
      observaciones: m.observaciones.trim() || null,
    };

    switch (tipo) {
      case 'ENTRADA':
        return { ...base, tipo: 'ENTRADA', ubicacion_destino_id: m.ubicacion_destino_id! };
      case 'SALIDA':
        return { ...base, tipo: 'SALIDA', ubicacion_origen_id: m.ubicacion_origen_id! };
      case 'TRASLADO':
        return {
          ...base,
          tipo: 'TRASLADO',
          ubicacion_origen_id: m.ubicacion_origen_id!,
          ubicacion_destino_id: m.ubicacion_destino_id!,
        };
    }
  }
}

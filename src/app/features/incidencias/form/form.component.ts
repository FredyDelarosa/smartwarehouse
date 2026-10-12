import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, maxLength, minLength, required, submit, type Field } from '@angular/forms/signals';

import { INCIDENCIA_TIPOS, type IncidenciaTipo } from '../../../core/models/incidencia.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/store/auth.store';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ProductoPickerComponent } from '../../../shared/pickers/producto-picker.component';
import { UbicacionPickerComponent } from '../../../shared/pickers/ubicacion-picker.component';
import { IncidenciasService } from '../incidencias.service';

type IncidenciaFormModel = {
  tipo: IncidenciaTipo;
  producto_id: number | null;
  ubicacion_id: number | null;
  descripcion: string;
};

/** Longitud mínima: un "faltante" sin contexto no sirve para nada. */
const MIN_DESCRIPCION = 10;

const ETIQUETA_TIPO: Record<IncidenciaTipo, string> = {
  MAL_UBICADO: 'Mal ubicado',
  FALTANTE: 'Faltante',
  DANADO: 'Dañado',
  OTRO: 'Otro',
};

const DESCRIPCION_TIPO: Record<IncidenciaTipo, string> = {
  MAL_UBICADO: 'El producto está en el almacén, pero en una ubicación distinta a la registrada.',
  FALTANTE: 'La cantidad registrada no aparece en el estante.',
  DANADO: 'Producto roto, mojado o con el empaque dañado.',
  OTRO: 'Cualquier otra situación que afecte al inventario.',
};

/**
 * Reportar una incidencia.
 *
 * Solo el tipo y la descripción son obligatorios: el producto y la ubicación
 * son opcionales porque hay incidencias (OTRO) que no son de un estante
 * concreto. Aun así, rellenarlos multiplica el valor del reporte.
 */
@Component({
  selector: 'sw-incidencia-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form.component.html',
  imports: [
    // Directiva de Signal Forms: habilita `[formField]` en el template.
    FormField,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    ProductoPickerComponent,
    UbicacionPickerComponent,
  ],
})
export class IncidenciaFormComponent {
  private readonly incidencias = inject(IncidenciasService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly store = inject(AuthStore);

  protected readonly tipos = INCIDENCIA_TIPOS;

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  private readonly model = signal<IncidenciaFormModel>({
    tipo: 'MAL_UBICADO',
    producto_id: null,
    ubicacion_id: null,
    descripcion: '',
  });

  readonly form = form(this.model, (f) => {
    required(f.tipo, { message: 'Selecciona el tipo de incidencia.' });
    required(f.descripcion, { message: 'Describe qué ocurrió.' });
    minLength(f.descripcion, MIN_DESCRIPCION, {
      message: `Describe el problema con al menos ${MIN_DESCRIPCION} caracteres.`,
    });
    maxLength(f.descripcion, 500, { message: 'La descripción es demasiado larga (máx. 500).' });
  });

  protected readonly tipoActual = computed(() => this.model().tipo);
  protected readonly descripcionTipo = computed(() => DESCRIPCION_TIPO[this.model().tipo]);
  protected readonly puedeReportar = computed(() => this.store.can('incidencias:crear'));

  // ── Acciones ─────────────────────────────────────────────────────────────

  protected onTipo(event: Event): void {
    this.model.update((m) => ({ ...m, tipo: (event.target as HTMLSelectElement).value as IncidenciaTipo }));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorServidor.set(null);

    if (!this.puedeReportar()) {
      this.errorServidor.set('No tienes permisos para reportar incidencias.');
      return;
    }

    void submit(this.form, async () => this.enviar());
  }

  protected cancelar(): void {
    void this.router.navigate(['/incidencias']);
  }

  /** Mensaje de validación de un campo, si ya se tocó. */
  protected errorDe(campo: Field<number | null> | Field<string>): string | null {
    const estado = campo();
    if (!estado.touched() || !estado.invalid()) return null;
    return estado.errors()[0]?.message ?? 'Valor inválido.';
  }

  private enviar(): void {
    const m = this.model();
    this.enviando.set(true);

    this.incidencias
      .crear({
        tipo: m.tipo,
        producto_id: m.producto_id,
        ubicacion_id: m.ubicacion_id,
        descripcion: m.descripcion.trim(),
      })
      .subscribe({
        next: (creada) => {
          this.enviando.set(false);
          this.notify.success(`Incidencia reportada (#${creada.id}). Queda abierta hasta que se resuelva.`);
          void this.router.navigate(['/incidencias']);
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.notify.apiError(err, 'No se pudo reportar la incidencia.');
        },
      });
  }

  protected readonly ETIQUETA_TIPO = ETIQUETA_TIPO;
  protected readonly DESCRIPCION_TIPO = DESCRIPCION_TIPO;
}

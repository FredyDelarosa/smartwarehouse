import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FORM_FIELD, type FormValueControl } from '@angular/forms/signals';

import type { Ubicacion } from '../../core/models/ubicacion.model';
import { BadgeComponent } from '../components/badge.component';
import { IconComponent } from '../components/icon.component';
import { UbicacionesLookupService } from './ubicaciones-lookup.service';

/** Cuántas opciones se pintan como mucho: mantiene el `<select>` usable. */
const MAX_OPCIONES = 60;

let seq = 0;

/**
 * Selector de ubicación: un input de texto que filtra por código, pasillo,
 * estante o nivel, más un `<select>` con los resultados.
 *
 * El listado completo (200 ubicaciones) se pide **una sola vez por sesión**
 * y se filtra en memoria: un almacén no tiene millones de estantes, y buscar
 * por HTTP en cada tecla sería peor para el usuario que un filtro local.
 *
 * Igual que `sw-producto-picker`, implementa `FormValueControl<number | null>`
 * para poder enlazarse con `[formField]` de un Signal Form.
 */
@Component({
  selector: 'sw-ubicacion-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ubicacion-picker.component.html',
  imports: [BadgeComponent, IconComponent],
})
export class UbicacionPickerComponent implements FormValueControl<number | null> {
  /** Valor del formulario: el `ubicacion_*_id`. */
  readonly value = model<number | null>(null);

  readonly label = input<string>('Ubicación');
  readonly placeholder = input<string>('Código, pasillo, estante o nivel');
  readonly obligatorio = input<boolean>(true);
  /** Oculta las ubicaciones dadas de baja (destino de una entrada). */
  readonly soloActivas = input<boolean>(false);

  private readonly lookup = inject(UbicacionesLookupService);
  private readonly campo = inject(FORM_FIELD, { optional: true });

  protected readonly filtroId = `sw-ubicacion-filtro-${seq++}`;
  protected readonly selectId = `sw-ubicacion-select-${seq++}`;

  /** Texto del filtro; no forma parte del formulario. */
  protected readonly filtro = signal('');

  private readonly todas = toSignal(this.lookup.listar(), { initialValue: [] as Ubicacion[] });

  private readonly candidatas = computed(() => {
    const soloActivas = this.soloActivas();
    return this.todas()
      .filter((u) => (soloActivas ? u.activo : true))
      .sort((a, b) => a.codigo_ubicacion.localeCompare(b.codigo_ubicacion, 'es'));
  });

  protected readonly opciones = computed<Ubicacion[]>(() => {
    const texto = this.filtro().trim().toLowerCase();
    const base = this.candidatas();
    const filtradas =
      texto.length === 0
        ? [...base]
        : base.filter((u) =>
            [u.codigo_ubicacion, u.codigo_qr, u.pasillo, u.estante, u.nivel]
              .join(' ')
              .toLowerCase()
              .includes(texto),
          );

    // La ubicación elegida siempre aparece en la lista aunque el filtro no la
    // alcance: si no, el `<select>` volvería a mostrar el placeholder y el
    // usuario perdería de vista qué había seleccionado.
    const actual = this.seleccionada();
    if (actual && !filtradas.some((u) => u.id === actual.id)) filtradas.unshift(actual);

    return filtradas.slice(0, MAX_OPCIONES);
  });

  protected readonly seleccionada = computed<Ubicacion | null>(() => {
    const id = this.value();
    if (id === null) return null;
    return this.lookup.cache().get(id) ?? this.todas().find((u) => u.id === id) ?? null;
  });

  /** ¿El texto filtrado no coincide con nada? Para no dejar dudas al usuario. */
  protected readonly sinCoincidencias = computed(
    () => this.filtro().trim().length > 0 && this.opciones().length === 0,
  );

  protected readonly error = computed<string | null>(() => {
    const estado = this.campo?.state();
    if (!estado || !estado.touched() || !estado.invalid()) return null;
    return estado.errors()[0]?.message ?? 'Valor inválido.';
  });

  protected onFiltro(event: Event): void {
    this.filtro.set((event.target as HTMLInputElement).value);
  }

  protected onSelect(event: Event): void {
    const bruto = (event.target as HTMLSelectElement).value;
    this.value.set(bruto === '' ? null : Number(bruto));
  }

  protected limpiar(): void {
    this.value.set(null);
    this.filtro.set('');
  }

  /** "P3 · A · 01" para la etiqueta de una opción. */
  protected etiqueta(u: Ubicacion): string {
    return `${u.codigo_ubicacion} — P${u.pasillo} · E${u.estante} · N${u.nivel}${u.activo ? '' : ' (inactiva)'}`;
  }

  /** El `<select>` trabaja con strings: "12" y 12 serían valores distintos. */
  protected valorDe(id: number): string {
    return String(id);
  }
}

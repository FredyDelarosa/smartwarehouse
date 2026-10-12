import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FORM_FIELD, type FormValueControl } from '@angular/forms/signals';
import { catchError, of, startWith, switchMap } from 'rxjs';

import type { Producto } from '../../core/models/producto.model';
import { debounceInput } from '../../core/utils/async';
import { BadgeComponent } from '../components/badge.component';
import { IconComponent } from '../components/icon.component';
import { ProductosLookupService } from './productos-lookup.service';

/** Espera a que el usuario termine de escribir antes de pedir productos. */
const DEBOUNCE_MS = 250;
/** Mínimo de caracteres para que la búsqueda signifique algo. */
const MIN_CARACTERES = 2;
/** Techo de sugerencias pintadas a la vez. */
const MAX_SUGERENCIAS = 8;

let seq = 0;

/**
 * Autocomplete de producto que **es un control de Signal Forms**.
 *
 * Implementa `FormValueControl<number | null>`, así que se enlaza con
 * `[formField]="form.producto_id"` igual que un `<input>` nativo: el
 * formulario no sabe que detrás hay una búsqueda HTTP.
 *
 * - `debounce(250 ms)` + `switchMap`: escribir rápido no genera una ráfaga de
 *   peticiones ni respuestas fuera de orden.
 * - El texto visible (`nombre`) y el valor del formulario (`id`) están
 *   separados a propósito: el campo del formulario es un número, no un string.
 * - Patrón combobox de WAI-ARIA: `aria-expanded`, `aria-activedescendant`,
 *   navegación con flechas y confirmación con Enter.
 */
@Component({
  selector: 'sw-producto-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './producto-picker.component.html',
  imports: [BadgeComponent, IconComponent],
})
export class ProductoPickerComponent implements FormValueControl<number | null> {
  /** Valor del formulario: el `producto_id`. */
  readonly value = model<number | null>(null);

  readonly label = input<string>('Producto');
  readonly placeholder = input<string>('Nombre o código del producto');
  /** Pinta el asterisco de campo obligatorio. */
  readonly obligatorio = input<boolean>(true);
  readonly autofocus = input<boolean>(false);

  private readonly lookup = inject(ProductosLookupService);
  private readonly debounce = debounceInput<string>(DEBOUNCE_MS);

  /** Estado del campo enlazado, si este control vive dentro de un formulario. */
  private readonly campo = inject(FORM_FIELD, { optional: true });

  protected readonly inputId = `sw-producto-${seq++}`;
  protected readonly listboxId = `${this.inputId}-listbox`;

  /** Texto visible en el input. */
  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  /** Índice de la sugerencia resaltada (-1 = ninguna). */
  protected readonly activo = signal(-1);

  protected readonly sugerencias = toSignal(
    this.debounce.value$.pipe(
      switchMap((texto) => {
        const limpio = texto.trim();
        if (limpio.length < MIN_CARACTERES) return of([] as Producto[]);
        return this.lookup
          .buscar(limpio, MAX_SUGERENCIAS)
          .pipe(catchError(() => of([] as Producto[])));
      }),
      startWith([] as Producto[]),
    ),
    { initialValue: [] as Producto[] },
  );

  /** Producto actualmente elegido, o null. */
  protected readonly seleccionado = computed<Producto | null>(() => {
    const id = this.value();
    return id === null ? null : (this.lookup.cache().get(id) ?? null);
  });

  protected readonly visible = computed(() => this.abierto() && this.sugerencias().length > 0);

  /** Mensaje de validación del campo enlazado (solo si ya se tocó). */
  protected readonly error = computed<string | null>(() => {
    const estado = this.campo?.state();
    if (!estado || !estado.touched() || !estado.invalid()) return null;
    return estado.errors()[0]?.message ?? 'Valor inválido.';
  });

  constructor() {
    // Si el valor llega desde fuera (restaurar un filtro, editar…), se pide
    // el producto para poder mostrar su nombre; al llegar a la caché, el
    // efecto se vuelve a ejecutar y escribe el texto.
    effect(() => {
      const id = this.value();
      if (id === null) {
        this.texto.set('');
        return;
      }
      const enCache = this.lookup.cache().get(id);
      if (enCache) this.texto.set(enCache.nombre);
      else this.lookup.asegurar(id);
    });
  }

  protected opcionId(index: number): string {
    return `${this.inputId}-opcion-${index}`;
  }

  protected onInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.texto.set(valor);
    this.activo.set(-1);
    this.abierto.set(true);
    this.debounce.input$.next(valor);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const lista = this.sugerencias();
    const visible = this.visible();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.abierto.set(true);
        this.activo.set((this.activo() + 1) % Math.max(lista.length, 1));
        break;
      case 'ArrowUp':
        if (!visible) return;
        event.preventDefault();
        this.activo.set((this.activo() - 1 + lista.length) % Math.max(lista.length, 1));
        break;
      case 'Enter': {
        // Con una sugerencia resaltada, Enter elige. Si no hay ninguna, el
        // evento sube al formulario, que ya valida que haya producto.
        const indice = this.activo();
        if (visible && indice >= 0 && lista[indice]) {
          event.preventDefault();
          this.elegir(lista[indice]!);
        }
        break;
      }
      case 'Escape':
        if (!visible) return;
        event.preventDefault();
        this.cerrar();
        break;
      default:
        break;
    }
  }

  /** Abre la lista sin disparar búsqueda: el foco no debe generar peticiones. */
  protected abrir(): void {
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.activo.set(-1);
    // Al perder el foco, el texto vuelve al valor real del campo: nunca se
    // "guarda" un nombre sin producto asociado.
    this.texto.set(this.seleccionado()?.nombre ?? '');
    this.debounce.input$.next('');
  }

  protected elegir(p: Producto): void {
    this.value.set(p.id);
    this.texto.set(p.nombre);
    this.activo.set(-1);
    this.abierto.set(false);
    this.debounce.input$.next('');
  }

  protected limpiar(): void {
    this.value.set(null);
    this.texto.set('');
    this.activo.set(-1);
    this.debounce.input$.next('');
  }
}

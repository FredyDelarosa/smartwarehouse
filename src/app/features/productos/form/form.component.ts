import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  min,
  minLength,
  pattern,
  readonly,
  required,
  submit,
  validate,
  type Field,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/models/error.model';
import type { Producto } from '../../../core/models/producto.model';
import { ApiService } from '../../../core/services/api.service';
import { CategoriasService } from '../../../core/services/categorias.service';
import { NotificationService } from '../../../core/services/notification.service';
import { errorDe as mensajeDe, esInvalido } from '../../../shared/utils/form-helpers';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { ProductosService } from '../productos.service';

/**
 * Unidades de medida que usa el almacén.
 *
 * No hay endpoint de catálogo para esto: son valores libres que el backend
 * acepta como string. Mantener la lista aquí evita que cada quien escriba
 * "litros" o "litro" indistintamente.
 */
const UNIDADES = ['pieza', 'par', 'unidad', 'caja', 'rollo', 'litro', 'paquete'] as const;

type ProductoFormModel = {
  codigo: string;
  nombre: string;
  descripcion: string;
  /**
   * String a propósito, no number.
   *
   * Un `<select>` con `[formField]` de Signal Forms entrega siempre `string`
   * (es el `value` del `<option>`). Guardarlo como `number` obligaría a
   * pelearse con los tipos del template; la conversión a número se hace una
   * única vez, al construir el payload. Vacío = sin categoría.
   */
  categoria_id: string;
  unidad_medida: string;
  stock_minimo: number | null;
  foto_url: string;
  activo: boolean;
};

const MODELO_VACIO: ProductoFormModel = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria_id: '',
  unidad_medida: 'pieza',
  stock_minimo: 0,
  foto_url: '',
  activo: true,
};

/**
 * Tipo que aceptan los helpers de `shared/utils/form-helpers`.
 * `form.codigo` es un `Field` (función): el estado vive dentro.
 */
type Campo = Field<string | number | boolean | null>;

/**
 * Alta y edición de productos con Signal Forms.
 *
 * El mismo componente sirve para las dos rutas (`nuevo` y `:id/editar`): lo
 * único que cambia es si llega un id. En edición el código NO se envía en el
 * PATCH —es la clave natural del producto y el backend lo trata como
 * inmutable— así que el input se muestra deshabilitado.
 */
@Component({
  selector: 'sw-producto-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form.component.html',
  imports: [
    RouterLink,
    FormField,
    ButtonComponent,
    IconComponent,
    SkeletonTableComponent,
  ],
})
export class ProductoFormComponent {
  private readonly api = inject(ApiService);
  private readonly productos = inject(ProductosService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  /** Catálogo de categorías. Se pide una vez y se cachea. */
  protected readonly categorias = inject(CategoriasService);

  /** Route param `:id` (solo en la ruta de edición). */
  readonly id = input<string>();

  protected readonly unidades = UNIDADES;

  protected readonly idNumero = computed(() => {
    const bruto = this.id();
    if (bruto === undefined || bruto === null || bruto.trim() === '') return null;
    const n = Number(bruto);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  protected readonly esEdicion = computed(() => this.idNumero() !== null);

  /** Id de categoría del producto en edición, para no perderlo al guardar. */
  protected readonly categoriaActual = computed<number | null>(() => {
    const cargado = this.existente.value();
    if (cargado) return cargado.categoria_id;
    const bruto = Number(this.model().categoria_id);
    return Number.isInteger(bruto) && bruto > 0 ? bruto : null;
  });

  /** Producto existente (solo en edición). */
  readonly existente = httpResource<Producto>(() => {
    const id = this.idNumero();
    return id === null ? undefined : this.api.url(`/productos/${id}`);
  });

  private readonly model = signal<ProductoFormModel>({ ...MODELO_VACIO });

  readonly form = form(this.model, (f) => {
    // En edición el código es inmutable: el campo pasa a solo lectura y el
    // PATCH no lo incluye. El input queda deshabilitado visualmente sin
    // `[disabled]`, porque `[formField]` es quien controla ese atributo.
    readonly(f.codigo, () => this.esEdicion());

    required(f.codigo, { message: 'El código es obligatorio.' });
    minLength(f.codigo, 2, { message: 'El código debe tener al menos 2 caracteres.' });
    maxLength(f.codigo, 20, { message: 'El código no puede pasar de 20 caracteres.' });
    pattern(f.codigo, /^[A-Za-z0-9._-]+$/, {
      message: 'Solo letras, números, punto, guion y guion bajo.',
    });

    required(f.nombre, { message: 'El nombre es obligatorio.' });
    minLength(f.nombre, 3, { message: 'El nombre debe tener al menos 3 caracteres.' });

    required(f.unidad_medida, { message: 'Selecciona una unidad de medida.' });

    min(f.stock_minimo, 0, { message: 'El stock mínimo no puede ser negativo.' });

    // La categoría viene de un `<select>`, así que no se escribe a mano. Vacío
    // significa "sin categoría" y es válido; si viene algo, tiene que ser un
    // id numérico (y por tanto existente en el catálogo).
    validate(f.categoria_id, (ctx) => {
      const valor = ctx.value().trim();
      if (valor === '') return null;
      const n = Number(valor);
      if (!Number.isInteger(n) || n <= 0) {
        return { kind: 'CATEGORIA_INVALIDA', message: 'Selecciona una categoría de la lista.' };
      }
      return null;
    });

    pattern(f.foto_url, /^https?:\/\/\S+$/i, {
      message: 'La URL debe empezar por http:// o https://',
    });
  });

  /** Campos sueltos: más cómodo de usar en el template que `form.campo`. */
  readonly campos = {
    codigo: this.form.codigo,
    nombre: this.form.nombre,
    descripcion: this.form.descripcion,
    categoria_id: this.form.categoria_id,
    unidad_medida: this.form.unidad_medida,
    stock_minimo: this.form.stock_minimo,
    foto_url: this.form.foto_url,
  };

  protected readonly guardando = signal(false);
  /** Error del servidor (409 por código duplicado, 422 de validación…). */
  protected readonly errorServidor = signal<string | null>(null);

  /** Evita que una recarga del recurso pise lo que el usuario ya escribió. */
  private hidratado = false;

  constructor() {
    // El catálogo se pide aunque hoy el backend devuelva 404: así, en cuanto
    // exista el endpoint, el `<select>` se rellena solo sin tocar nada.
    this.categorias.cargar();

    effect(() => {
      const producto = this.existente.value();
      if (!producto || this.hidratado) return;
      this.hidratado = true;
      this.model.set({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion ?? '',
        categoria_id: producto.categoria_id === null ? '' : String(producto.categoria_id),
        unidad_medida: producto.unidad_medida,
        stock_minimo: producto.stock_minimo,
        foto_url: producto.foto_url ?? '',
        activo: producto.activo,
      });
    });
  }

  /**
   * Mensaje inline de un campo (solo si el usuario ya lo tocó) y su estado
   * inválido para `aria-invalid`. Delegan en los helpers compartidos.
   */
  protected readonly errorDe = (campo: Campo): string | null => mensajeDe(campo);
  protected readonly invalid = (campo: Campo): boolean => esInvalido(campo);

  protected onSubmit(event: Event): Promise<boolean> {
    event.preventDefault();
    this.errorServidor.set(null);
    return submit(this.form, async () => this.guardar());
  }

  private async guardar(): Promise<void> {
    if (this.guardando()) return;

    const m = this.model();
    this.guardando.set(true);

    try {
      const id = this.idNumero();
      const comunes = {
        nombre: m.nombre.trim(),
        descripcion: m.descripcion.trim() || null,
        // El `<select>` entrega string; el backend espera int|null. Vacío → null.
        categoria_id: m.categoria_id.trim() ? Number(m.categoria_id) : null,
        unidad_medida: m.unidad_medida,
        stock_minimo: m.stock_minimo ?? 0,
        foto_url: m.foto_url.trim() || null,
        activo: m.activo,
      };

      const producto = await firstValueFrom(
        id === null
          ? this.productos.crear({ ...comunes, codigo: m.codigo.trim() })
          : // El código no se edita: no lo mandamos en el PATCH.
            this.productos.actualizar(id, comunes),
      );

      this.notify.success(
        id === null ? `Producto ${producto.codigo} creado.` : `Producto ${producto.codigo} actualizado.`,
      );
      await this.router.navigate(['/productos', producto.id]);
    } catch (err: unknown) {
      // 409 = código duplicado: el mensaje del backend dice exactamente cuál.
      if (err instanceof ApiError && err.isConflict) {
        this.errorServidor.set(err.message);
      } else {
        this.notify.apiError(err, 'No se pudo guardar el producto.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
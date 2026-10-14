import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';

import type { Ubicacion } from '../../../core/models/ubicacion.model';
import { ApiError } from '../../../core/models/error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { errorDe, esInvalido } from '../../../shared/utils/form-helpers';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { QrCodeComponent } from '../../../shared/components/qr-code.component';
import { UbicacionesService } from '../ubicaciones.service';

/**
 * Sin `almacen_id`: el almacén lo decide la sesión, no el formulario.
 *
 * Estaba aquí con un `1` fijo porque el backend lo exigía en el cuerpo. Con un
 * solo almacén era inofensivo, pero en cuanto haya más de uno abría la
 * escritura cruzada: mandar el id de otro creaba la ubicación en su almacén.
 */
type UbicacionFormModel = {
  pasillo: string;
  estante: string;
  nivel: string;
  codigo_ubicacion: string;
  codigo_qr: string;
  coordenada_x: string;
  coordenada_y: string;
  activo: boolean;
};

const MODELO_VACIO: UbicacionFormModel = {
  pasillo: '',
  estante: '',
  nivel: '',
  codigo_ubicacion: '',
  codigo_qr: '',
  coordenada_x: '',
  coordenada_y: '',
  activo: true,
};

/** Normaliza a mayúsculas sin espacios: " p 1 " → "P1". */
function normalizar(valor: string): string {
  return valor.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Alta y edición de ubicaciones.
 *
 * El mismo componente sirve para `nueva` y `:id/editar`: lo que cambia es si
 * llega un id.
 *
 * `codigo_ubicacion` y `codigo_qr` se derivan de pasillo/estante/nivel: el
 * usuario no debería escribirlos a mano y desincronizarlos del resto. Se
 * permiten editar solo en alta, y aun así se autocompletan.
 */
@Component({
  selector: 'sw-ubicacion-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form.component.html',
  imports: [ButtonComponent, IconComponent, FormField, QrCodeComponent],
})
export class FormComponent {
  private readonly svc = inject(UbicacionesService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  /**
 * Route param `:id` de la ruta de edición.
 *
 * El nombre DEBE coincidir con el parámetro de ruta: `withComponentInputBinding`
 * empareja por nombre, así que llamarlo `ubicacionId` hacía que nunca llegara
 * valor (el formulario de edición arrancaba vacío, como si fuera "nueva"). Y el
 * router entrega **string**, sin coaccionar a number.
 */
readonly id = input<string>();

/** Id validado, o null en modo "nueva ubicación". */
protected readonly idNumero = computed<number | null>(() => {
  const bruto = this.id()?.trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : null;
});

  private readonly model = signal<UbicacionFormModel>({ ...MODELO_VACIO });

  readonly form = form(this.model, (f) => {
    required(f.pasillo, { message: 'Indica el pasillo (ej. P3).' });
    required(f.estante, { message: 'Indica el estante (ej. B).' });
    required(f.nivel, { message: 'Indica el nivel (ej. 02).' });
    required(f.codigo_ubicacion, { message: 'Se genera a partir del pasillo, estante y nivel.' });
  });

  protected readonly currentField = this.form.pasillo;
  protected readonly estanteField = this.form.estante;
  protected readonly nivelField = this.form.nivel;

  protected readonly cargando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly esEdicion = computed(() => this.idNumero() !== null);

  /** Componentes del código de ubicación, para la vista previa en vivo. */
  protected readonly codigoCalculado = computed(() => {
    const { pasillo, estante, nivel } = this.model();
    if (!pasillo || !estante || !nivel) return '';
    return `${normalizar(pasillo)}-${normalizar(estante)}-${normalizar(nivel)}`;
  });

  /** Contenido del QR: el manual si el usuario lo escribió, si no el derivado. */
  protected readonly qrDe = computed(() => {
    const manual = this.model().codigo_qr.trim();
    return manual || (this.codigoCalculado() ? `QR-${this.codigoCalculado()}` : '');
  });

  protected readonly errorPasillo = () => errorDe(this.form.pasillo as never);
  protected readonly errorEstante = () => errorDe(this.form.estante as never);
  protected readonly errorNivel = () => errorDe(this.form.nivel as never);
  protected readonly pasilloInvalido = () => esInvalido(this.form.pasillo as never);
  protected readonly estanteInvalido = () => esInvalido(this.form.estante as never);
  protected readonly nivelInvalido = () => esInvalido(this.form.nivel as never);

  /**
   * Precarga los datos cuando la ruta trae `:id` (modo edición).
   *
   * Se dispara con `afterRenderEffect` y no desde el constructor: con
   * `withComponentInputBinding` el router asigna el input DESPUÉS de construir
   * el componente. Antes esto era un método que nadie llamaba y el formulario
   * de edición arrancaba siempre vacío, como si fuera "nueva ubicación".
   */
  constructor() {
    afterRenderEffect(() => {
      const id = this.idNumero();
      if (id === null || id === this.idCargado) return;
      this.idCargado = id;
      this.cargarSiEdicion(id);
    });
  }

  private idCargado: number | null = null;

  private cargarSiEdicion(id: number): void {
    if (this.model().pasillo) return; // ya cargado
    this.cargando.set(true);
    this.svc.obtener(id).subscribe({
      next: (u: Ubicacion) => {
        this.model.set({
          pasillo: u.pasillo,
          estante: u.estante,
          nivel: u.nivel,
          codigo_ubicacion: u.codigo_ubicacion,
          codigo_qr: u.codigo_qr,
          coordenada_x: u.coordenada_x ?? '',
          coordenada_y: u.coordenada_y ?? '',
          activo: u.activo,
        });
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.notify.apiError(err, 'No se pudo cargar la ubicación.');
      },
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorServidor.set(null);

    void submit(this.form, async () => {
      this.cargando.set(true);
      this.enviar();
    });
  }

  private enviar(): void {
    const m = this.model();
    const codigo = this.codigoCalculado();

    const payload = {
      pasillo: normalizar(m.pasillo),
      estante: normalizar(m.estante),
      nivel: normalizar(m.nivel).padStart(2, '0'),
      codigo_ubicacion: codigo,
      // El QR sigue la convención del almacén: QR-<código de ubicación>.
      codigo_qr: m.codigo_qr.trim() || `QR-${codigo}`,
      coordenada_x: m.coordenada_x.trim() || null,
      coordenada_y: m.coordenada_y.trim() || null,
      activo: m.activo,
    };

    const id = this.idNumero();
    const peticion = id === null
      ? this.svc.crear(payload)
      : this.svc.actualizar(id, payload);

    peticion.subscribe({
      next: (u) => {
        this.cargando.set(false);
        this.notify.success(`Ubicación ${u.codigo_ubicacion} guardada.`);
        void this.router.navigate(['/ubicaciones', u.id]);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        // 409: el código ya existe. El mensaje del backend dice cuál.
        this.errorServidor.set(
          err instanceof ApiError ? err.message : 'No se pudo guardar la ubicación.',
        );
      },
    });
  }

  protected cancelar(): void {
    const id = this.idNumero();
    void this.router.navigate(id === null ? ['/ubicaciones'] : ['/ubicaciones', id]);
  }
}
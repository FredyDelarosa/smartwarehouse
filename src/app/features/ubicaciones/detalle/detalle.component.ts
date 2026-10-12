import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ProductoEnUbicacion, Ubicacion } from '../../../core/models/ubicacion.model';
import { formatNumber } from '../../../core/utils/format';
import { AuthStore } from '../../../core/store/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { QrCodeComponent } from '../../../shared/components/qr-code.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { UbicacionesService } from '../ubicaciones.service';

/**
 * Detalle de una ubicación.
 *
 * Resuelve el caso "llegué al estante y ¿qué debería haber aquí?": la lista
 * de productos con su cantidad, tal como la devuelve el endpoint de QR.
 */
@Component({
  selector: 'sw-ubicacion-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detalle.component.html',
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    QrCodeComponent,
    SkeletonComponent,
  ],
})
export class DetalleComponent {
  private readonly svc = inject(UbicacionesService);
  private readonly notify = inject(NotificationService);
  private readonly qr = inject(QrCodeService);
  readonly store = inject(AuthStore);

  /**
 * Route param `:id`.
 *
 * DOS trampas aquí, y las dos se comieron una implementación:
 *
 * 1. El input DEBE llamarse `id`. `withComponentInputBinding` empareja el
 *    nombre del input con el nombre del parámetro de ruta; si se llama
 *    `ubicacionId`, nunca recibe el valor y la pantalla se queda en
 *    "Cargando" para siempre.
 * 2. El router entrega **string**, no number. `input.required<number>()` no
 *    coacciona: llega "1", y `Number.isFinite("1")` es false.
 *
 * Por eso el input es `id: string` y la conversión va en un computed aparte.
 */
readonly id = input<string>();

/** Id ya validado, o null si la ruta no trae uno usable. */
protected readonly ubicacionId = computed<number | null>(() => {
  const bruto = this.id()?.trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : null;
});

  protected readonly ubicacion = signal<Ubicacion | null>(null);
  protected readonly productos = signal<ProductoEnUbicacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /**
   * Unidades mezcladas en un mismo estante. El endpoint de QR no devuelve la
   * unidad por producto, así que se muestra el total sin unidad.
   */
  protected readonly totalPiezas = computed(() =>
    this.productos().reduce((acc, p) => acc + p.cantidad, 0),
  );

  protected readonly puedeEditar = computed(() => this.store.can('ubicaciones:crear'));

  private idCargado: number | null = null;

  /**
   * Se reacciona al signal del input, no se llama a `cargar()` a ciegas.
   *
   * Con `withComponentInputBinding` el router asigna los inputs DESPUÉS de
   * construir el componente: pedir los datos en el constructor (o en un
   * `queueMicrotask`) los pide antes de tiempo. El `effect` sí corre con los
   * inputs ya asignados, y además vuelve a pedir si el usuario navega entre
   * ubicaciones sin que se destruya el componente.
   */
  constructor() {
    // `afterRenderEffect` y no `effect`: con `withComponentInputBinding` el
    // router asigna los inputs DESPUÉS de construir el componente, y un
    // `effect` puede correr antes de tiempo (la petición salía con id null y
    // la pantalla se quedaba en "Cargando"). Tras el render, los inputs ya
    // están; además vuelve a pedir si el usuario navega entre ubicaciones.
    afterRenderEffect(() => {
      const id = this.ubicacionId();
      if (id === this.idCargado) return;
      this.idCargado = id;
      this.cargar(id);
    });
  }

  /**
   * Limitación de la API documentada: `GET /ubicaciones/{id}` devuelve la
   * ubicación, pero NO sus productos. La única forma de obtener el contenido
   * de un estante es `GET /ubicaciones/qr/{codigo_qr}`, que sí incluye
   * `productos[]`. Por eso cargamos primero la ubicación y luego pedimos su
   * código QR para listar el contenido.
   *
   * Si algún día el backend añade `productos` a `GET /ubicaciones/{id}`,
   * basta reemplazar este método por una sola llamada. Ver DECISIONS.md §3.8.
   */
  private cargar(id: number | null): void {
    this.cargando.set(true);
    this.error.set(null);
    this.ubicacion.set(null);
    this.productos.set([]);

    if (id === null) {
      this.cargando.set(false);
      this.error.set('Ubicación no válida.');
      return;
    }

    this.svc.obtener(id).subscribe({
      next: (ubicacion) => {
        this.ubicacion.set(ubicacion);
        this.cargando.set(false);
        this.cargarProductos(ubicacion.codigo_qr);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar la ubicación. Puede que ya no exista.');
        this.ubicacion.set(null);
      },
    });
  }

  private cargarProductos(codigoQr: string): void {
    this.svc.porQr(codigoQr).subscribe({
      next: (r) => this.productos.set(r.productos),
      // Sin productos listados no es un fallo: el estante puede estar vacío.
      error: () => this.productos.set([]),
    });
  }

  protected readonly fmt = { formatNumber };

  /** Descarga la etiqueta de esta ubicación como SVG vectorial. */
  protected descargarQr(u: Ubicacion): void {
    this.qr.descargar(u.codigo_qr, `${u.codigo_qr}.svg`);
  }

  /** Descarga la misma etiqueta como PNG (para Presentations, etc.). */
  protected descargarPng(u: Ubicacion): void {
    this.qr.descargarPng(u.codigo_qr, `${u.codigo_qr}.png`);
  }
}
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type {
  CargaInicialResultado,
  LineaCargaInicial,
} from '../../../core/models/inventario.model';
import { ApiError } from '../../../core/models/error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ProductoPickerComponent } from '../../../shared/pickers/producto-picker.component';
import { UbicacionPickerComponent } from '../../../shared/pickers/ubicacion-picker.component';
import { UbicacionesLookupService } from '../../../shared/pickers/ubicaciones-lookup.service';
import { ProductosLookupService } from '../../../shared/pickers/productos-lookup.service';
import { InventarioService } from '../inventario.service';

/**
 * Una fila del formulario. El `id` es local y solo sirve para ordenar y para
 * quitar: no se manda al backend.
 */
type Linea = LineaCargaInicial & { id: number };

let seq = 0;

function lineaVacia(): Linea {
  return {
    id: ++seq,
    producto_id: 0,
    ubicacion_id: 0,
    cantidad: 0,
  };
}

/**
 * Carga inicial del stock.
 *
 * ## Por qué existe esto y no un movimiento suelto
 *
 * Poner un almacén en marcha son cientos de líneas: producto, estante,
 * cantidad. Con `/movimientos/entrada` son cientos de peticiones y, peor,
 * cientos de formularios que rellenar. Aquí se escriben todas de golpe y el
 * backend las mete en una sola transacción.
 *
 * ## Por qué NO es un atajo que se salte los movimientos
 *
 * Cada línea genera un movimiento ENTRADA de verdad, con su usuario y su
 * fecha. El stock no aparece por la puerta de atrás: una conciliación de
 * inventario necesita que toda entrada tenga detrás una operación con fecha y
 * responsable, la carga inicial incluida.
 *
 * ## Si una línea falla
 *
 * Las demás se cargan igual y el resultado viene línea a línea. Se muestra en
 * la tabla final con el motivo de cada fallo, para poder corregir solo eso.
 */
@Component({
  selector: 'sw-carga-inicial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carga-inicial.component.html',
  imports: [
    ButtonComponent,
    IconComponent,
    ProductoPickerComponent,
    UbicacionPickerComponent,
  ],
})
export class CargaInicialComponent {
  private readonly svc = inject(InventarioService);
  private readonly notify = inject(NotificationService);
  private readonly productosLookup = inject(ProductosLookupService);
  private readonly ubicacionesLookup = inject(UbicacionesLookupService);
  private readonly router = inject(Router);

  protected readonly lineas = signal<Linea[]>([lineaVacia()]);
  protected readonly cargando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly resultado = signal<CargaInicialResultado | null>(null);
  protected readonly referencia = signal('');
  protected readonly observaciones = signal('');


  /** Una línea está lista si tiene producto, ubicación y cantidad. */
  protected completa(l: Linea): boolean {
    return l.producto_id > 0 && l.ubicacion_id > 0 && l.cantidad > 0;
  }

  /** Solo se envían las completas: una fila a medio rellenar no es un error. */
  protected validas(): Linea[] {
    return this.lineas().filter(this.completa);
  }

  /** Pares producto+ubicación repetidos: el backend los rechaza y se avisa antes. */
  protected duplicadas(): Set<number> {
    const vistas = new Set<string>();
    const repetidas = new Set<number>();
    for (const l of this.validas()) {
      const clave = `${l.producto_id}:${l.ubicacion_id}`;
      if (vistas.has(clave)) repetidas.add(l.id);
      vistas.add(clave);
    }
    return repetidas;
  }

  protected puedeEnviar(): boolean {
    const validas = this.validas();
    return validas.length > 0 && this.duplicadas().size === 0 && !this.cargando();
  }

  protected anadir(): void {
    this.lineas.update((l) => [...l, lineaVacia()]);
  }

  protected quitar(id: number): void {
    this.lineas.update((l) => {
      const quedan = l.filter((x) => x.id !== id);
      return quedan.length > 0 ? quedan : [lineaVacia()];
    });
  }

  protected actualizar(id: number, cambios: Partial<Linea>): void {
    this.lineas.update((l) => l.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
  }

  /**
   * Añade dos filas con el mismo producto ya elegido.
   *
   * Al cargar «Tornillos» en cinco estantes, elegirlo cinco veces es el
   * trabajo de esta pantalla. Copiar lo evita.
   */
  protected repetirProducto(origen: Linea): void {
    this.lineas.update((l) => [
      ...l,
      { ...lineaVacia(), producto_id: origen.producto_id },
      { ...lineaVacia(), producto_id: origen.producto_id },
    ]);
  }

  protected totalUnidades(): number {
    return this.validas().reduce((s, l) => s + l.cantidad, 0);
  }

  protected enviable(): boolean {
    return this.puedeEnviar();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) return;
    this.errorServidor.set(null);
    this.cargando.set(true);

    this.svc
      .cargaInicial({
        lineas: this.validas().map((l) => ({
          producto_id: l.producto_id,
          ubicacion_id: l.ubicacion_id,
          cantidad: l.cantidad,
        })),
        referencia: this.referencia().trim() || null,
        observaciones: this.observaciones().trim() || null,
      })
      .subscribe({
        next: (r) => {
          this.cargando.set(false);
          this.resultado.set(r);
          if (r.fallidas === 0) {
            this.notify.success(`Carga inicial completada: ${r.registradas} líneas.`);
          } else {
            this.notify.warning(
              `${r.registradas} cargadas y ${r.fallidas} con errores. Revisa el detalle.`,
            );
          }
        },
        error: (err: unknown) => {
          this.cargando.set(false);
          this.errorServidor.set(this.mensaje(err));
        },
      });
  }

  protected otraCarga(): void {
    this.lineas.set([lineaVacia()]);
    this.referencia.set('');
    this.observaciones.set('');
    this.resultado.set(null);
  }

  protected verInventario(): void {
    void this.router.navigate(['/inventario']);
  }

  /** El lookup resuelve nombre y código; la tabla los muestra aunque falten. */
  protected nombreProducto(id: number): string {
    return this.productosLookup.nombreDe(id) ?? `Producto ${id}`;
  }

  protected codigoProducto(id: number): string {
    return this.productosLookup.codigoDe(id) ?? '—';
  }

  protected codigoUbicacion(id: number): string {
    return this.ubicacionesLookup.codigoDe(id) ?? `Ubicación ${id}`;
  }

  private mensaje(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.isNetwork) return 'No hay conexión con el servidor.';
      const errores = (err as { detalles?: { errores?: string[] } }).detalles?.errores;
      if (errores?.length) return errores.join(' ');
      return err.message;
    }
    return 'No se pudo hacer la carga inicial.';
  }
}
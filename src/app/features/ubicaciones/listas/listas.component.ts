import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import type { ResumenAlmacen } from '../../../core/models/configuracion.model';
import type { Ubicacion, UbicacionStock } from '../../../core/models/ubicacion.model';
import { ApiError } from '../../../core/models/error.model';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import {
  agruparPorPasillo,
  estantesDe,
  paginarTodo,
  type PasilloResumen,
} from './listas.model';

type Alcance = 'pasillo' | 'estante';

/** Respuesta de reserva si `GET /configuracion/almacen` no está disponible. */
const RESUMEN_VACIO: ResumenAlmacen = {
  nombre: 'Almacén',
  total_ubicaciones: 0,
  activas: 0,
  fuera_servicio: 0,
  pasillos: 0,
  niveles: 0,
  configurado: false,
};

/**
 * Listas de contenido por pasillo o por estante.
 *
 * ## Qué sustituye y qué no
 *
 * Sustituye al **escaneo** en el día a día: en vez de apuntar la cámara a una
 * etiqueta para ver qué hay dentro, se mira una hoja colgada en el estante. El
 * QR se conserva —escáner y etiquetas siguen donde estaban— porque las 150
 * etiquetas del almacén original ya están impresas y sirven.
 *
 * ## La diferencia honesta
 *
 * El QR se escanea y siempre está al día; una lista impresa es una
 * fotografía. Se acepta porque es legible sin cámara y porque se reimprime
 * cuando el almacén cambia, pero no es un sustituto exacto: si se mueven tres
 * cajas, la lista sigue diciendo lo de hasta ayer. Por eso la hoja lleva la
 * fecha de impresión en el pie.
 *
 * ## Por qué dos peticiones
 *
 * `GET /inventario/ubicaciones` solo devuelve ubicaciones **con existencias**.
 * Sin la lista completa de ubicaciones no se puede saber cuántos estantes hay
 * en un pasillo, y una lista que calla un estante vacío hace pensar que se le
 * ha olvidado. Se piden las dos y se dice en pantalla cuántos estantes hay sin
 * stock.
 */
@Component({
  selector: 'sw-listas-almacen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listas.component.html',
  imports: [ButtonComponent, IconComponent],
})
export class ListasComponent {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);

  protected readonly alcance = signal<Alcance>('pasillo');
  protected readonly pasilloElegido = signal<string | null>(null);
  protected readonly estanteElegido = signal<string | null>(null);

  protected readonly cargando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  /** Filas de GET /inventario/ubicaciones: solo ubicaciones con existencias. */
  private readonly _stock = signal<UbicacionStock[]>([]);
  /** Todas las ubicaciones del almacén, para contar estantes vacíos. */
  private readonly _todas = signal<Ubicacion[]>([]);
  private readonly _cargado = signal(false);

  /** Fecha de la impresión, en la hoja. Se fija al cargar, no al imprimir. */
  protected readonly fecha = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    if (this._cargado()) return;
    this._cargado.set(true);
    this.cargando.set(true);
    this.errorServidor.set(null);

    this.api
      .get<ResumenAlmacen>('/configuracion/almacen')
      .pipe(catchError(() => of(RESUMEN_VACIO)))
      .subscribe((almacen) => this.nombreAlmacen.set(almacen.nombre));

    forkJoin({
      stock: this.todasLasPaginas<UbicacionStock>('/inventario/ubicaciones'),
      todas: this.todasLasPaginas<Ubicacion>('/ubicaciones/', { solo_activas: true }),
    }).subscribe({
      next: ({ stock, todas }) => {
        this._stock.set(stock);
        this._todas.set(todas);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorServidor.set(
          err instanceof ApiError
            ? err.isNetwork
              ? 'No hay conexión con el servidor.'
              : err.message
            : 'No se pudo cargar el contenido del almacén.',
        );
      },
    });
  }

  /**
   * Todas las páginas de un listado, en una sola respuesta.
   *
   * La lógica está en `paginarTodo` y no aquí a propósito: dentro del
   * componente quedaba enterrada y su fallo —`expand` mezclando arrays y
   * centinelas— se veía como un error de carga con la API respondiendo 200.
   */
  private todasLasPaginas<T>(
    ruta: string,
    params: Record<string, string | number | boolean> = {},
  ): Observable<T[]> {
    return paginarTodo<T>((skip, limit) =>
      this.api.get<T[]>(ruta, { ...params, skip, limit }),
    );
  }

  // ── Derivados ───────────────────────────────────────────────────────
  protected readonly pasillos = computed(() => agruparPorPasillo(this._stock()));

  protected readonly pasilloActual = computed<PasilloResumen | undefined>(() => {
    const elegido = this.pasilloElegido();
    return this.pasillos().find((p) => p.pasillo === elegido);
  });

  protected readonly estantesDelPasillo = computed(() => estantesDe(this.pasilloActual()));

  /** Estantes del pasillo que existen pero no tienen nada guardado. */
  protected readonly estantesVacios = computed(() => {
    const pasillo = this.pasilloElegido();
    if (!pasillo) return [];
    const conStock = new Set(this.pasillos().find((p) => p.pasillo === pasillo)?.estantes.map((e) => e.estante));
    const todos = new Set(
      this._todas().filter((u) => u.pasillo === pasillo).map((u) => u.estante),
    );
    return [...todos].filter((e) => !conStock.has(e)).sort();
  });

  protected readonly estanteActual = computed(() =>
    this.estantesDelPasillo().find((e) => e.estante === this.estanteElegido()),
  );

  /**
   * Nombre del almacén, para el encabezado de la hoja.
   *
   * Va en la hoja porque la lista se imprime y se cuelga en el estante: una
   * lista de la nave de arriba tiene que distinguirse de una de la de abajo.
   */
  protected readonly nombreAlmacen = signal('Almacén');

  protected hayContenido(): boolean {
    const p = this.pasilloActual();
    return p !== undefined && p.totalUnidades > 0;
  }

  // ── Acciones ────────────────────────────────────────────────────────
  protected elegirPasillo(pasillo: string): void {
    this.pasilloElegido.set(pasillo);
    // El estante elegido puede no existir en el pasillo nuevo: se suelta para
    // que no aparezca una hoja de un estante que ya no está.
    this.estanteElegido.set(null);
  }

  protected elegirEstante(estante: string): void {
    this.estanteElegido.set(estante);
  }

  protected cambiarAlcance(nuevo: Alcance): void {
    this.alcance.set(nuevo);
  }

  /**
   * Imprime la hoja.
   *
   * `window.print()` sin argumentos imprime la página entera: el CSS de
   * impresión oculta los controles con `print:hidden`, que es el mismo
   * patrón que usa la pantalla de etiquetas.
   */
  protected imprimir(): void {
    if (!this.hayContenido()) {
      this.notify.warning('Ese pasillo no tiene nada que listar.');
      return;
    }
    window.print();
  }
}
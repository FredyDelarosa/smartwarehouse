import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, startWith, switchMap } from 'rxjs';

import type { Producto } from '../../../core/models/producto.model';
import type {
  BusquedaFinalizada,
  UbicacionConCantidad,
} from '../../../core/models/busqueda.model';
import { ApiError } from '../../../core/models/error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { debounceInput } from '../../../core/utils/async';
import { formatDuration } from '../../../core/utils/format';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { SkeletonTableComponent } from '../../../shared/components/skeleton-table.component';
import { BusquedasService } from '../busquedas.service';
import { ProductosService } from '../../productos/productos.service';

/** Cuánto esperamos tras la última pulsación antes de pedir productos. */
const DEBOUNCE_MS = 250;

type Resultado = {
  producto: Producto | null;
  stockTotal: number;
  ubicaciones: UbicacionConCantidad[];
  busquedaId: number;
};

/**
 * Paso 1 — Buscar producto.
 *
 * Autocomplete con debounce de 250 ms y `switchMap`: escribir rápido no
 * genera una ráfaga de peticiones ni respuestas fuera de orden.
 *
 * Al elegir un producto se llama a `POST /busquedas/iniciar`, que ya
 * devuelve las ubicaciones con existencias: el worker no espera un segundo
 * viaje al backend.
 */
@Component({
  selector: 'sw-buscar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buscar.component.html',
  imports: [
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    BadgeComponent,
  ],
})
export class BuscarComponent {
  private readonly busquedas = inject(BusquedasService);
  private readonly productos = inject(ProductosService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly debounce = debounceInput<string>(DEBOUNCE_MS);

  protected readonly termino = signal('');

  /** Sugerencias del autocomplete. */
  protected readonly sugerencias = toSignal(
    this.debounce.value$.pipe(
      switchMap((texto) => {
        const limpio = texto.trim();
        if (limpio.length < 2) return of([] as Producto[]);
        return this.productos.buscar({ termino: limpio, limit: 8 }).pipe(
          catchError(() => of([] as Producto[])),
        );
      }),
      startWith([] as Producto[]),
    ),
    { initialValue: [] as Producto[] },
  );

  protected readonly buscando = signal(false);
  protected readonly resultados = signal<Resultado | null>(null);
  protected readonly error = signal<string | null>(null);
  /** true cuando el usuario aún no ha buscado nada. */
  protected readonly estadoInicial = signal(true);

  constructor() {
    // Si el usuario llegó desde la topbar con ?q=…, arrancamos ya con término.
    const inicial = this.route.snapshot.queryParamMap.get('q');
    if (inicial) {
      this.termino.set(inicial);
      this.debounce.input$.next(inicial);
    }
  }

  protected onInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.termino.set(valor);
    this.debounce.input$.next(valor);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.debounce.input$.next('');
  }

  /** Elige un producto del autocomplete → inicia la búsqueda en el backend. */
  protected elegir(producto: Producto): void {
    this.termino.set(producto.nombre);
    this.debounce.input$.next('');
    this.iniciar({ producto_id: producto.id, termino_busqueda: producto.nombre });
  }

  /** Enter con texto libre: busca por nombre (el backend toma la 1ª coincidencia). */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    const texto = this.termino().trim();
    if (texto.length < 2) return;
    this.debounce.input$.next('');
    this.iniciar({ producto_id: null, termino_busqueda: texto });
  }

  private iniciar(request: { producto_id: number | null; termino_busqueda: string }): void {
    this.buscando.set(true);
    this.error.set(null);
    this.estadoInicial.set(false);

    this.busquedas.iniciar(request).subscribe({
      next: (r) => {
        this.buscando.set(false);
        this.resultados.set({
          producto: r.producto,
          stockTotal: r.stock_total,
          ubicaciones: r.ubicaciones,
          busquedaId: r.busqueda_id,
        });
      },
      error: (err: unknown) => {
        this.buscando.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'No se pudo iniciar la búsqueda.');
      },
    });
  }

  /** Limpia el formulario para buscar otro producto. */
  protected reiniciar(): void {
    this.resultados.set(null);
    this.resumen.set(null);
    this.registroFallido.set(false);
    this.termino.set('');
    this.error.set(null);
    this.estadoInicial.set(true);
    this.debounce.input$.next('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected irAlHistorial(): void {
    void this.router.navigate(['/busquedas/historial']);
  }

  /** Ordena por cantidad descendente: lo que hay en más cantidad, primero. */
  protected readonly ordenadas = computed(() =>
    [...(this.resultados()?.ubicaciones ?? [])].sort((a, b) => b.cantidad - a.cantidad),
  );

  /** Sin resultados: el backend devolvió producto null o sin ubicaciones. */
  protected readonly sinCoincidencias = computed(() => {
    const r = this.resultados();
    return r !== null && r.producto === null;
  });

  /** El producto existe pero no tiene existencias registradas. */
  protected readonly sinStock = computed(() => {
    const r = this.resultados();
    return r !== null && r.producto !== null && r.ubicaciones.length === 0;
  });

  /** Confirmación en curso, para bloquear el doble clic. */
  protected readonly confirmando = signal<number | null>(null);

  /** Resumen tras confirmar: se muestra encima del resultado. */
  protected readonly resumen = signal<BusquedaFinalizada | null>(null);

  /** El backend no pudo registrar la confirmación (ver DECISIONS.md BUG-1). */
  protected readonly registroFallido = signal(false);

  /**
   * Paso 2 — el worker confirma dónde encontró el producto.
   *
   * El backend cronometra el tiempo desde `iniciar` y lo devuelve aquí:
   * ese número es el indicador clave del proyecto.
   */
  protected confirmar(u: UbicacionConCantidad, producto: Producto): void {
    const actual = this.resultados();
    if (!actual || this.confirmando() !== null) return;

    this.confirmando.set(u.ubicacion_id);

    this.busquedas.finalizar(actual.busquedaId, {
      ubicacion_encontrada_id: u.ubicacion_id,
      observaciones: `Encontrado ${producto.nombre} (${producto.codigo}) en ${u.codigo_ubicacion}.`,
    }).subscribe({
      next: (r) => {
        this.confirmando.set(null);
        this.resumen.set(r);
        this.notify.success(
          `Registrado en ${u.codigo_ubicacion}. Tiempo: ${formatDuration(r.tiempo_busqueda_segundos)}.`,
        );
      },
      error: (err: unknown) => {
        this.confirmando.set(null);

        // 404 = el backend no encuentra la búsqueda que él mismo acaba de
        // crear (BUG-1 documentado en DECISIONS.md). El trabajador ya tiene
        // la ubicación en pantalla: avisamos y lo dejamos seguir, sin
        // reintentar automáticamente para no generar ruido.
        if (err instanceof ApiError && err.isNotFound) {
          this.registroFallido.set(true);
          this.notify.warning(
            `El servidor no pudo registrar la búsqueda en ${u.codigo_ubicacion}. El tiempo no se guardó.`,
          );
          return;
        }

        this.notify.apiError(err, 'No se pudo registrar la confirmación.');
      },
    });
  }
}

/** Reexportado para los tests. */
export const BUSQUEDA_DEBOUNCE_MS = DEBOUNCE_MS;
export type { Resultado };
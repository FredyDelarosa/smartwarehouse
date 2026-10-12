import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { type Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';

/**
 * Debounce reutilizable para autocompletados.
 *
 * Devuelve dos piezas: el `Subject` donde escribes y el `Observable` ya
 * debounced. Se usan por separado porque el observable se encadena con
 * `switchMap` dentro de un `toSignal`, mientras el subject se escribe desde
 * el template.
 *
 * ```ts
 * private readonly termino = debounceInput<string>(250);
 *
 * readonly resultados = toSignal(
 *   this.termino.value$.pipe(switchMap((t) => this.svc.buscar(t))),
 *   { initialValue: [] as Producto[] },
 * );
 *
 * // template: (input)="termino.input$.next($any($event.target).value)"
 * ```
 *
 * `distinctUntilChanged` evita repetir la petición cuando el usuario borra y
 * reescribe el mismo texto.
 */
export function debounceInput<T>(ms: number): {
  input$: Subject<T>;
  value$: Observable<T>;
} {
  const input$ = new Subject<T>();
  const value$ = input$.pipe(debounceTime(ms), distinctUntilChanged());
  return { input$, value$ };
}

/**
 * Convierte un Observable a signal ligado al ciclo de vida del componente.
 * Evita `| async` + `async` en templates y no requiere limpiar suscripciones
 * a mano.
 */
export function fromSignal<T>(source: Observable<T>, initial: T) {
  return toSignal(source.pipe(takeUntilDestroyed()), { initialValue: initial });
}
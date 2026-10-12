import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';

import { QrCodeService, type QrNivel } from '../../core/services/qrcode.service';

/**
 * Renderiza un código QR a partir de un texto.
 *
 * El SVG se inserta por DOM (no `[innerHTML]`) porque el string lo genera una
 * librería de terceros: meterlo en el binding obligaría a sanitize y rompería
 * los `<path>`, o a usar `bypassSecurityTrustHtml` (agujero de XSS).
 *
 * Es decorativo para el lector de pantalla (`aria-hidden`): el código legible
 * va siempre en el `<figcaption>`, que es lo que una persona con baja visión
 * necesita. Un QR no es leible por un screen reader.
 */
@Component({
  selector: 'sw-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure [class]="wrapperClasses()">
      <div
        #codigo
        class="rounded-lg bg-white p-2 [&>svg]:block [&>svg]:size-full [&>svg]:h-auto"
        [style.width.px]="tamano()"
        [style.height.px]="tamano()"
        aria-hidden="true"
      ></div>

      @if (pie()) {
        <figcaption class="text-center">
          @if (codigoTexto()) {
            <p class="sw-code font-semibold text-foreground">{{ codigoTexto() }}</p>
          }
          @if (descripcion()) {
            <p class="mt-0.5 text-[11px] text-muted-foreground">{{ descripcion() }}</p>
          }
        </figcaption>
      }
    </figure>
  `,
})
export class QrCodeComponent {
  private readonly qr = inject(QrCodeService);

  /** Contenido del QR. En el almacén: el `codigo_qr` de la ubicación. */
  readonly valor = input.required<string>();
  /** Lado del cuadrado en píxeles CSS. */
  readonly tamano = input<number>(180);
  /** Código legible que se imprime bajo el QR (obligatorio si `pie`). */
  readonly codigoTexto = input<string>('');
  /** Texto secundario, p. ej. "Pasillo 3 · Estante B · Nivel 2". */
  readonly descripcion = input<string>('');
  readonly nivel = input<QrNivel>('H');
  /** Muestra el código legible debajo del QR. */
  readonly pie = input<boolean>(true);

  private readonly host = viewChild<ElementRef<HTMLElement>>('codigo');

  /**
   * `afterRenderEffect` y no `effect` + `afterNextRender`.
   *
   * `effect` corre ANTES de que exista el `viewChild`, y `afterNextRender` se
   * dispara una sola vez: con varias etiquetas en la misma pantalla (la hoja de
   * impresión dibuja una por ubicación) solo se pintaba la primera.
   * `afterRenderEffect` espera al render y se re-ejecuta cuando cambia cualquier
   * signal leído, que es justo lo que necesitamos.
   */
  constructor() {
    afterRenderEffect(() => {
      const el = this.host()?.nativeElement;
      if (!el) return;

      const texto = this.valor();
      if (!texto) {
        el.innerHTML = '';
        return;
      }

      // Zona tranquila proporcional: 4 módulos es el mínimo del estándar, pero
      // en una etiqueta sucia conviene algo más de aire alrededor.
      const margen = Math.max(2, Math.round(this.tamano() / 45));
      this.qr.insertarEn(el, texto, { margin: margen, nivel: this.nivel() });
    });
  }

  protected wrapperClasses(): string {
    return this.pie()
      ? 'flex flex-col items-center gap-2'
      : 'inline-block';
  }
}
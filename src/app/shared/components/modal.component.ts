import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { IconComponent } from './icon.component';

let nextId = 0;

/** Selector de todo lo que puede recibir foco dentro del diálogo. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal accesible (dialog) — patrón WAI-ARIA APG.
 *
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.
 * - Al abrir: guarda el elemento con el foco, lo restaura al cerrar.
 * - Tab atrapado dentro del diálogo (focus trap).
 * - Escape cierra.
 * - Bloquea el scroll del fondo.
 *
 * El click en el fondo cierra SOLO si el target es el propio overlay: si
 * el usuario arrastra desde dentro hacia fuera no se cierra por error.
 */
@Component({
  selector: 'sw-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      El overlay solo existe si el modal está abierto. Si no se ocultara, su
      fondo (bg-slate-900/50) taparía la página entera y bloquearía los clics
      aunque el diálogo "no estuviera ahí".
    -->
    @if (abierto()) {
      <div
        #host
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
        (click)="onBackdrop($event)"
        (keydown)="onKeydown($event)"
      >
        <div
          #panel
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="tituloId"
          [attr.aria-describedby]="subtitle() ? subtituloId : null"
          [class]="panelClasses()"
        >
          <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div class="min-w-0">
              <h2 [id]="tituloId" class="text-base font-semibold text-foreground">
                {{ title() }}
              </h2>
              @if (subtitle()) {
                <p [id]="subtituloId" class="mt-0.5 text-sm text-muted-foreground">
                  {{ subtitle() }}
                </p>
              }
            </div>
            <button
              type="button"
              (click)="cerrar.emit()"
              class="-mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
              aria-label="Cerrar diálogo"
            >
              <sw-icon name="cerrar" [size]="18" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <ng-content />
          </div>

          @if (footer()) {
            <footer class="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <ng-content select="[sw-modal-footer]" />
            </footer>
          }
        </div>
      </div>
    }
  `,
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly abierto = input.required<boolean>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly footer = input<boolean>(false);
  readonly cerrar = output<void>();

  readonly tituloId = `sw-modal-${nextId++}`;
  readonly subtituloId = `${this.tituloId}-sub`;

  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('host');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private previouslyFocused: HTMLElement | null = null;
  private wasOpen = false;

  constructor() {
    // El contenido solo existe dentro del `@if (abierto())` del template, así
    // que el foco se espera un frame después de abrir.
    effect(() => {
      const abierto = this.abierto();
      if (abierto && !this.wasOpen) {
        this.wasOpen = true;
        this.onOpen();
      } else if (!abierto && this.wasOpen) {
        this.wasOpen = false;
        this.onClose();
      }
    });
  }

  panelClasses(): string {
    const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;
    return [
      'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface',
      'rounded-t-2xl shadow-overlay sm:rounded-2xl',
      sizes[this.size()],
    ].join(' ');
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.hostRef()?.nativeElement) this.cerrar.emit();
  }

  onEscape(): void {
    if (this.abierto()) this.cerrar.emit();
  }

  /** Focus trap: Tab cicla dentro del panel. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusables = this.focusables();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.panelRef()?.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    const panel = this.panelRef()?.nativeElement;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  }

  private onOpen(): void {
    document.body.classList.add('sw-scroll-lock');
    this.previouslyFocused = document.activeElement as HTMLElement | null;

    // Dos frames: uno para que el panel entre en el DOM y otro para que tenga
    // layout (si no, focus() no hace nada).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const panel = this.panelRef()?.nativeElement;
        if (!panel) return;
        const target =
          panel.querySelector<HTMLElement>('[autofocus]') ??
          this.focusables()[0] ??
          panel;
        target.focus();
      }),
    );
  }

  private onClose(): void {
    document.body.classList.remove('sw-scroll-lock');
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;
  }
}
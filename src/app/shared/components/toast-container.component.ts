import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { NotificationService, type Toast, type ToastKind } from '../../core/services/notification.service';
import { IconComponent, type IconName } from './icon.component';

const ICON: Record<ToastKind, IconName> = {
  exito: 'check',
  error: 'alerta',
  aviso: 'alerta',
  info: 'info',
};

const TONE: Record<ToastKind, string> = {
  exito: 'border-success/40 bg-success-surface text-success',
  error: 'border-danger/40 bg-danger-surface text-danger',
  aviso: 'border-warning/40 bg-warning-surface text-warning',
  info: 'border-info/40 bg-info-surface text-info',
};

/**
 * Pila de notificaciones.
 *
 * - `role="status"` (no `alert`) para exito/info y `role="alert"` para
 *   error/aviso: los errores interrumpen, los demás no.
 * - Vive en un `aria-live="polite"` para que el lector de pantalla anuncie
 *   los mensajes sin robar el foco.
 */
@Component({
  selector: 'sw-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          [class]="toastClasses(toast)"
          [attr.role]="toast.kind === 'error' || toast.kind === 'aviso' ? 'alert' : 'status'"
        >
          <sw-icon [name]="iconFor(toast)" [size]="18" class="mt-px shrink-0" />

          <p class="min-w-0 flex-1 text-sm leading-snug break-words">{{ toast.message }}</p>

          @if (toast.action; as action) {
            <button
              type="button"
              (click)="runAction(toast)"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline underline-offset-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {{ action.label }}
            </button>
          }

          <button
            type="button"
            (click)="dismiss(toast.id)"
            class="-mr-1 shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar notificación"
          >
            <sw-icon name="cerrar" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  imports: [IconComponent],
})
export class ToastContainerComponent {
  private readonly notifications = inject(NotificationService);

  readonly toasts = computed(() => this.notifications.toasts());

  iconFor(toast: Toast): IconName {
    return ICON[toast.kind];
  }

  toastClasses(toast: Toast): string {
    return [
      'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3',
      'shadow-raised backdrop-blur-sm',
      TONE[toast.kind],
    ].join(' ');
  }

  dismiss(id: number): void {
    this.notifications.dismiss(id);
  }

  runAction(toast: Toast): void {
    this.dismiss(toast.id);
    toast.action?.run();
  }
}
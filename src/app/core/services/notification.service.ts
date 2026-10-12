import { Service, signal } from '@angular/core';

import { ApiError } from '../models/error.model';

export type ToastKind = 'exito' | 'error' | 'info' | 'aviso';

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  /** Acción opcional ("Reintentar"). */
  action?: { label: string; run: () => void };
  /** ms hasta el auto-descarte. 0 = no se cierra solo. */
  timeout: number;
};

const DEFAULT_TIMEOUT = 5000;
const ERROR_TIMEOUT = 8000;

/**
 * Cola de notificaciones (toasts).
 *
 * Sin dependencias: la UI se suscribe al signal `toasts` desde
 * `shared/components/toast-container`. Un `ErrorHandler` global la inyecta
 * para que ningún error de red quede invisible.
 */
@Service()
export class NotificationService {
  private seq = 0;
  private items: Toast[] = [];

  /** Única fuente de verdad; se lee como signal desde los componentes. */
  readonly toasts = signal<Toast[]>([]);

  success(message: string, action?: Toast['action']): number {
    return this.push('exito', message, action, DEFAULT_TIMEOUT);
  }

  info(message: string, action?: Toast['action']): number {
    return this.push('info', message, action, DEFAULT_TIMEOUT);
  }

  warning(message: string, action?: Toast['action']): number {
    return this.push('aviso', message, action, DEFAULT_TIMEOUT);
  }

  error(message: string, action?: Toast['action']): number {
    return this.push('error', message, action, ERROR_TIMEOUT);
  }

  /** Muestra el mensaje de un ApiError con un copy más útil por status. */
  apiError(error: unknown, fallback = 'Ocurrió un error inesperado'): number {
    const message =
      error instanceof ApiError
        ? friendlyMessage(error, fallback)
        : error instanceof Error
          ? error.message
          : fallback;
    return this.push('error', message, undefined, ERROR_TIMEOUT);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
    this.emit();
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit();
  }

  private push(
    kind: ToastKind,
    message: string,
    action: Toast['action'] | undefined,
    timeout: number,
  ): number {
    const id = ++this.seq;
    this.items = [...this.items, { id, kind, message, action, timeout }];
    this.emit();
    if (timeout > 0 && typeof setTimeout === 'function') {
      setTimeout(() => this.dismiss(id), timeout);
    }
    return id;
  }

  private emit(): void {
    this.toasts.set([...this.items]);
  }
}

const MESSAGES: Record<number, string> = {
  400: 'La solicitud no es válida. Revisa los datos introducidos.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'Conflicto: el registro ya existe o no hay stock suficiente.',
  422: 'Los datos no superaron la validación del servidor.',
};

export function friendlyMessage(error: ApiError, fallback: string): string {
  if (error.isNetwork) return error.message;
  return error.message || MESSAGES[error.status] || fallback;
}
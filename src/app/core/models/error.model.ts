/**
 * Errores de la API.
 *
 * El backend responde SIEMPRE con esta forma en 4xx/5xx:
 *   { "error_code": "...", "message": "...", "details": {...}? }
 */

export type ApiErrorBody = {
  error_code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

/**
 * Error normalizado que lanza `ApiService`.
 * Siempre instanceof Error, con `status` y `errorCode` para tomar decisiones.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details: Record<string, unknown> | null;
  /** URL que falló, útil para depurar. */
  readonly url: string;

  constructor(init: {
    status: number;
    errorCode: string;
    message: string;
    details?: Record<string, unknown> | null;
    url: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.errorCode = init.errorCode;
    this.details = init.details ?? null;
    this.url = init.url;
  }

  /** ¿La sesión caducó y hay que redirigir a login? */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 409: duplicado o stock insuficiente. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** 400/422: el body no pasó la validación del backend. */
  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}
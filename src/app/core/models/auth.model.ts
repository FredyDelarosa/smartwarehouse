/**
 * DTOs de autenticación.
 * Espejo de: POST /auth/login, POST /auth/refresh, GET /auth/me,
 *             POST /auth/change-password
 */

/** Respuesta de login y de refresh. */
export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer' | string;
  /** Segundos de validez del access token (28800 = 8 h). */
  expires_in: number;
};

/** Cuerpo de POST /auth/login y POST /auth/refresh. */
export type LoginRequest = {
  email: string;
  password: string;
};

export type RefreshRequest = {
  refresh_token: string;
};

/** Cuerpo de POST /auth/change-password. Responde 204. */
export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

/**
 * Usuario autenticado. GET /auth/me.
 * OJO: `nombre_rol` es un string legible ("Administrador"), no un enum.
 */
export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol_id: number;
  nombre_rol: string;
  activo: boolean;
  fecha_creacion: string | null;
  ultimo_acceso: string | null;
};
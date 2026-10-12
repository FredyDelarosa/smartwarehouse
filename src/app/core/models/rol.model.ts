/**
 * Roles y permisos.
 *
 * El backend expone el rol del usuario como `nombre_rol` (string legible) en
 * GET /auth/me, y protege cada endpoint por rol. La tabla de permisos de
 * abajo es la traducción cliente de esas restricciones del servidor.
 *
 * ⚠️ IMPORTANTE: esto NO es autorización. Es solo UI. El backend sigue
 * siendo la única fuente de verdad; un usuario sin permisos verá el botón
 * deshabilitado pero el endpoint seguirá respondiendo 403 si lo intenta.
 */

/** `rol_id` según el backend. */
export type RolId = 1 | 2 | 3;

/** Nombre canónico del rol, tal y como lo devuelve `nombre_rol`. */
export type RolNombre = 'Administrador' | 'Supervisor' | 'Almacenero';

export const ROL_NOMBRES: readonly RolNombre[] = [
  'Administrador',
  'Supervisor',
  'Almacenero',
] as const;

/** Mapa rol_id -> nombre. Si el backend añade roles, actualiza aquí. */
export const ROL_POR_ID: Readonly<Record<number, RolNombre>> = {
  1: 'Administrador',
  2: 'Supervisor',
  3: 'Almacenero',
};

/**
 * Permisos por rol.
 *
 * `null` = cualquiera autenticado. Cada clave corresponde a una acción de la
 * UI; los guards de ruta (`core/guards/role.guard.ts`) leen de aquí.
 */
export type Permiso =
  | 'productos:crear'
  | 'productos:editar'
  | 'productos:eliminar'
  | 'ubicaciones:crear'
  | 'movimientos:registrar'
  | 'incidencias:crear'
  | 'incidencias:resolver'
  | 'metricas:ver';

export const PERMISOS_POR_ROL: Readonly<Record<RolNombre, readonly Permiso[]>> = {
  Administrador: [
    'productos:crear',
    'productos:editar',
    'productos:eliminar',
    'ubicaciones:crear',
    'movimientos:registrar',
    'incidencias:crear',
    'incidencias:resolver',
    'metricas:ver',
  ],
  Supervisor: [
    'productos:crear',
    'productos:editar',
    'movimientos:registrar',
    'incidencias:crear',
    'incidencias:resolver',
    'metricas:ver',
  ],
  Almacenero: ['movimientos:registrar', 'incidencias:crear', 'incidencias:resolver'],
};

/** Usuario de prueba, por si hace falta autocompletar el login en dev. */
export const USUARIOS_DEMO: readonly { email: string; password: string; rol: RolNombre }[] = [
  { email: 'ana.torres@xyz.com', password: 'Demo1234!', rol: 'Administrador' },
  { email: 'carlos.ruiz@xyz.com', password: 'Demo1234!', rol: 'Supervisor' },
  { email: 'luis.mendoza@xyz.com', password: 'Demo1234!', rol: 'Almacenero' },
];
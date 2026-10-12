import { computed, Service, signal } from '@angular/core';

import { PERMISOS_POR_ROL, type Permiso, type RolNombre } from '../models/rol.model';
import type { Usuario } from '../models/auth.model';

const ACCESS_KEY = 'sw.access_token';
const REFRESH_KEY = 'sw.refresh_token';
const EXPIRES_KEY = 'sw.expires_at';
const USER_KEY = 'sw.user';

/**
 * Estado de autenticación con signals.
 *
 * Los tokens viven en localStorage para que una recarga mantenga la sesión.
 * El usuario se cachea en localStorage para pintar el shell sin esperar a
 * `GET /auth/me` (evita un parpadeo en la topbar), y se refresca al arrancar.
 */
@Service()
export class AuthStore {
  private readonly _user = signal<Usuario | null>(readUser());
  private readonly _accessToken = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  private readonly _expiresAt = signal<number | null>(readExpiry());
  private readonly _initialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  /** Hay un access token guardado (puede estar caducado; el interceptor lo refresca). */
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  readonly rolNombre = computed<RolNombre | null>(() => {
    const u = this._user();
    if (!u) return null;
    return (u.nombre_rol as RolNombre) ?? null;
  });

  readonly rolId = computed<number | null>(() => this._user()?.rol_id ?? null);

  /** Iniciales para el avatar de la topbar. */
  readonly iniciales = computed(() => {
    const nombre = this._user()?.nombre ?? '';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
    return (partes[0]![0]! + partes[1]![0]!).toUpperCase();
  });

  // ── Mutadores ──────────────────────────────────────────────────────────

  setTokens(access: string, refresh: string, expiresInSeconds: number): void {
    this._accessToken.set(access);
    this._refreshToken.set(refresh);
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this._expiresAt.set(expiresAt);
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(EXPIRES_KEY, String(expiresAt));
  }

  setUser(user: Usuario | null): void {
    this._user.set(user);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  clear(): void {
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._expiresAt.set(null);
    this._user.set(null);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
  }

  markInitialized(): void {
    this._initialized.set(true);
  }

  // ── Lectores para interceptors (fuera del contexto de inyección) ───────

  getAccessToken(): string | null {
    return this._accessToken();
  }

  getRefreshToken(): string | null {
    return this._refreshToken();
  }

  /** ¿El access token caduca dentro de `margenMs`? (refresh proactivo) */
  isExpiringSoon(margenMs = 30_000): boolean {
    const exp = this._expiresAt();
    if (exp === null) return false;
    return Date.now() >= exp - margenMs;
  }

  // ── Permisos ──────────────────────────────────────────────────────────

  /**
   * ¿El usuario actual tiene este permiso?
   * Desconocido (rol no mapeado) → false: preferimos ocultar antes que fallar.
   */
  can(permiso: Permiso): boolean {
    const rol = this.rolNombre();
    if (!rol) return false;
    const permisos = PERMISOS_POR_ROL[rol];
    return permisos ? permisos.includes(permiso) : false;
  }

  canAny(...permisos: Permiso[]): boolean {
    return permisos.some((p) => this.can(p));
  }

  hasRol(...roles: RolNombre[]): boolean {
    const actual = this.rolNombre();
    return actual !== null && roles.includes(actual);
  }
}

function readExpiry(): number | null {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readUser(): Usuario | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}
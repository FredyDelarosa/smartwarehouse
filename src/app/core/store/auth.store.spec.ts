import { beforeEach, describe, expect, it } from 'vitest';

import type { Usuario } from '../models/auth.model';
import { PERMISOS_POR_ROL } from '../models/rol.model';
import { AuthStore } from './auth.store';

function usuario(rol_id: number, nombre_rol: string): Usuario {
  return {
    id: 99,
    nombre: 'Usuario Prueba',
    email: 'prueba@xyz.com',
    rol_id,
    nombre_rol,
    activo: true,
    fecha_creacion: null,
    ultimo_acceso: null,
  };
}

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    store = new AuthStore();
  });

  describe('tokens', () => {
    it('arranca sin sesión', () => {
      expect(store.isAuthenticated()).toBe(false);
      expect(store.user()).toBeNull();
      expect(store.rolNombre()).toBeNull();
    });

    it('guarda los tokens y calcula la expiración', () => {
      store.setTokens('acc', 'ref', 3600);

      expect(store.getAccessToken()).toBe('acc');
      expect(store.getRefreshToken()).toBe('ref');
      expect(store.isAuthenticated()).toBe(true);
      expect(localStorage.getItem('sw.access_token')).toBe('acc');
    });

    it('clear() borra el estado y el almacenamiento', () => {
      store.setTokens('acc', 'ref', 3600);
      store.setUser(usuario(1, 'Administrador'));
      store.clear();

      expect(store.isAuthenticated()).toBe(false);
      expect(store.user()).toBeNull();
      expect(localStorage.getItem('sw.access_token')).toBeNull();
      expect(localStorage.getItem('sw.refresh_token')).toBeNull();
      expect(localStorage.getItem('sw.user')).toBeNull();
    });
  });

  describe('isExpiringSoon', () => {
    it('false sin expiración registrada', () => {
      expect(store.isExpiringSoon()).toBe(false);
    });

    it('true cuando caduca dentro del margen', () => {
      store.setTokens('acc', 'ref', 10); // caduca en 10 s
      expect(store.isExpiringSoon(30_000)).toBe(true);
    });

    it('false cuando queda bastante margen', () => {
      store.setTokens('acc', 'ref', 3600);
      expect(store.isExpiringSoon(30_000)).toBe(false);
    });

    it('true cuando ya caducó', () => {
      store.setTokens('acc', 'ref', -1);
      expect(store.isExpiringSoon()).toBe(true);
    });
  });

  describe('permisos', () => {
    it('un Almacenero puede registrar movimientos pero no crear productos', () => {
      store.setUser(usuario(3, 'Almacenero'));

      expect(store.can('movimientos:registrar')).toBe(true);
      expect(store.can('incidencias:crear')).toBe(true);
      expect(store.can('productos:crear')).toBe(false);
      expect(store.can('productos:eliminar')).toBe(false);
      expect(store.can('metricas:ver')).toBe(false);
    });

    it('un Supervisor crea productos pero no los da de baja', () => {
      store.setUser(usuario(2, 'Supervisor'));

      expect(store.can('productos:crear')).toBe(true);
      expect(store.can('productos:editar')).toBe(true);
      expect(store.can('productos:eliminar')).toBe(false);
      expect(store.can('metricas:ver')).toBe(true);
    });

    it('un Administrador puede todo lo de la tabla', () => {
      store.setUser(usuario(1, 'Administrador'));

      for (const permiso of PERMISOS_POR_ROL['Administrador']) {
        expect(store.can(permiso)).toBe(true);
      }
      expect(store.canAny('productos:eliminar', 'metricas:ver')).toBe(true);
    });

    it('un rol desconocido no concede permisos (fail-closed)', () => {
      store.setUser(usuario(9, 'Invitado'));

      expect(store.can('movimientos:registrar')).toBe(false);
      expect(store.canAny('productos:crear', 'incidencias:crear')).toBe(false);
    });

    it('sin usuario no concede nada', () => {
      expect(store.can('movimientos:registrar')).toBe(false);
    });
  });

  describe('hasRol', () => {
    it('reconoce los roles asignados', () => {
      store.setUser(usuario(3, 'Almacenero'));

      expect(store.hasRol('Almacenero')).toBe(true);
      expect(store.hasRol('Administrador', 'Almacenero')).toBe(true);
      expect(store.hasRol('Administrador')).toBe(false);
    });
  });

  describe('iniciales', () => {
    it('toma la primera letra del nombre y del apellido', () => {
      store.setUser({ ...usuario(1, 'Administrador'), nombre: 'Ana Torres' });
      expect(store.iniciales()).toBe('AT');
    });

    it('con un solo nombre toma las dos primeras letras', () => {
      store.setUser({ ...usuario(1, 'Administrador'), nombre: 'Ana' });
      expect(store.iniciales()).toBe('AN');
    });

    it('sin nombre devuelve interrogación', () => {
      expect(store.iniciales()).toBe('?');
    });
  });
});
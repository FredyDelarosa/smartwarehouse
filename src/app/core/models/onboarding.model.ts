/**
 * DTOs del alta de almacén con su administrador.
 * Espejo de: POST /auth/onboarding
 *
 * ⚠️ `OnboardingRequest` NO lleva `rol_id`. Quien da de alta el almacén es su
 * administrador, y el backend lo decide: admitirlo en el cuerpo dejaría que
 * alguien se autoasignara permisos.
 */

import type { TokenResponse, Usuario } from './auth.model';

export type OnboardingAlmacenRequest = {
  nombre: string;
  direccion?: string | null;
};

export type OnboardingUsuarioRequest = {
  nombre: string;
  email: string;
  password: string;
};

export type OnboardingRequest = {
  almacen: OnboardingAlmacenRequest;
  usuario: OnboardingUsuarioRequest;
};

/** Un almacén recién creado. */
export type Almacen = {
  id: number;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  created_at: string | null;
};

export type OnboardingResponse = {
  almacen: Almacen;
  usuario: Usuario;
  token: TokenResponse;
};
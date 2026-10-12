import { inject, Service } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

import type {
  ChangePasswordRequest,
  LoginRequest,
  TokenResponse,
  Usuario,
} from '../models/auth.model';
import { ApiError } from '../models/error.model';
import { ApiService } from './api.service';
import { AuthStore } from '../store/auth.store';

/**
 * Operaciones de autenticación.
 * El store solo guarda estado; este service habla con la API.
 */
@Service()
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly store = inject(AuthStore);

  login(credentials: LoginRequest): Observable<Usuario> {
    return this.api.post<TokenResponse>('/auth/login', credentials).pipe(
      tap((tokens) => this.persistTokens(tokens)),
      switchMap(() => this.me()),
    );
  }

  /** GET /auth/me */
  me(): Observable<Usuario> {
    return this.api.get<Usuario>('/auth/me').pipe(tap((user) => this.store.setUser(user)));
  }

  /** POST /auth/refresh — renueva el access token usando el refresh token. */
  refresh(): Observable<string> {
    const refreshToken = this.store.getRefreshToken();
    if (!refreshToken) {
      return throwError(
        () =>
          new ApiError({
            status: 401,
            errorCode: 'NO_REFRESH_TOKEN',
            message: 'No hay sesión para renovar.',
            url: '/auth/refresh',
          }),
      );
    }

    return this.api
      .post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken } satisfies
        { refresh_token: string })
      .pipe(
        tap((tokens) => this.persistTokens(tokens)),
        map((tokens) => tokens.access_token),
      );
  }

  /** POST /auth/change-password — responde 204. */
  changePassword(body: ChangePasswordRequest): Observable<void> {
    return this.api.post<null>('/auth/change-password', body).pipe(map(() => undefined));
  }

  logout(): void {
    this.store.clear();
  }

  /**
   * Arranque de la app: si hay sesión guardada, revalidamos el perfil en
   * segundo plano. Cualquier fallo (401 incluido) cierra la sesión para no
   * dejar la UI en un estado medio autenticado.
   */
  bootstrap(): Observable<unknown> {
    if (!this.store.isAuthenticated()) {
      this.store.markInitialized();
      return of(null);
    }
    return this.me().pipe(
      catchError(() => {
        this.store.clear();
        return of(null);
      }),
      finalize(() => this.store.markInitialized()),
    );
  }

  private persistTokens(tokens: TokenResponse): void {
    this.store.setTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
  }
}
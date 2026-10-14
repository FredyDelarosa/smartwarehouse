import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';

import type { OnboardingRequest, OnboardingResponse } from '../models/onboarding.model';
import { ApiService } from './api.service';
import { AuthStore } from '../store/auth.store';

/**
 * Alta de un almacén nuevo con su administrador.
 *
 * Es la única operación de esta app que deja al usuario con sesión: el backend
 * devuelve el token porque acaba de crear la contraseña y pedirla otra vez
 * sería absurdo. Por eso, a diferencia de `AuthService.login`, aquí NO se
 * llama a `me()` después: la respuesta ya trae el usuario completo y un viaje
 * extra solo sería una espera.
 *
 * Aun así se guardan los tokens: sin ellos, el store seguiría considerando al
 * usuario anónimo y el `authGuard` lo echaría al login en la navegación
 * siguiente.
 */
@Service()
export class OnboardingService {
  private readonly api = inject(ApiService);
  private readonly store = inject(AuthStore);

  registrar(request: OnboardingRequest): Observable<OnboardingResponse> {
    return this.api.post<OnboardingResponse>('/auth/onboarding', request).pipe(
      tap((res) =>
        this.store.setTokens(
          res.token.access_token,
          res.token.refresh_token,
          res.token.expires_in,
        ),
      ),
      tap((res) => this.store.setUser(res.usuario)),
    );
  }
}
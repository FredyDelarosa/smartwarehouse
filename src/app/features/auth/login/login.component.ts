import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, email, form, minLength, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/models/error.model';
import { USUARIOS_DEMO } from '../../../core/models/rol.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { errorDe as mensajeDe, esInvalido } from '../../../shared/utils/form-helpers';

type LoginModel = { email: string; password: string };

/**
 * Login con Signal Forms (`@angular/forms/signals`, estable en v22).
 *
 * API real de Angular 22 (la del plan usaba una API de borrador distinta):
 *   form(signal(model), (f) => { required(f.email); email(f.email); })
 *   template: <input [formField]="form.email">
 *   submit:   await submit(form, async () => { ... })
 *
 * `submit()` valida, marca todo como tocado y SOLO entonces ejecuta la
 * acción: el usuario ve de entrada qué campos fallan en vez de un
 * formulario que parece no hacer nada.
 */
@Component({
  selector: 'sw-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  imports: [ButtonComponent, IconComponent, FormField, RouterLink],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  private readonly model = signal<LoginModel>({ email: '', password: '' });

  readonly form = form(this.model, (f) => {
    required(f.email, { message: 'Ingresa tu correo.' });
    email(f.email, { message: 'El correo no tiene un formato válido.' });
    required(f.password, { message: 'Ingresa tu contraseña.' });
    minLength(f.password, 8, { message: 'La contraseña debe tener al menos 8 caracteres.' });
  });

  // `form.email` es un `Field` (función). El template se enlaza con él
  // directamente (`[formField]="emailField"`); para leer el estado hay que
  // invocarlo, y eso lo encapsulan `errorDe` / `esInvalido`.
  readonly emailField = this.form.email;
  readonly passwordField = this.form.password;

  /** Mensaje inline del primer error del campo, si ya fue tocado. */
  protected readonly errorEmail = () => mensajeDe(this.form.email);
  protected readonly errorPassword = () => mensajeDe(this.form.password);
  protected readonly emailInvalido = () => esInvalido(this.form.email);
  protected readonly passwordInvalido = () => esInvalido(this.form.password);

  readonly cargando = signal(false);
  readonly errorServidor = signal<string | null>(null);
  readonly mostrarDemo = signal(false);

  protected readonly demos = USUARIOS_DEMO;

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorServidor.set(null);
    void submit(this.form, async () => {
      this.cargando.set(true);
      this.autenticar();
    });
  }

  /** Rellena y envía con un usuario de demo (solo útil en desarrollo). */
  protected usarDemo(email: string, password: string): void {
    this.mostrarDemo.set(false);
    this.form.email().value.set(email);
    this.form.password().value.set(password);
    void submit(this.form, async () => {
      this.cargando.set(true);
      this.autenticar();
    });
  }

  private autenticar(): void {
    const { email, password } = this.model();

    this.auth.login({ email: email.trim(), password }).subscribe({
      next: (usuario) => {
        this.cargando.set(false);
        this.notify.success(`Bienvenido, ${usuario.nombre.split(' ')[0]}.`);
        const returnUrl = new URLSearchParams(location.search).get('returnUrl');
        void this.router.navigateByUrl(returnUrl ?? '/dashboard');
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorServidor.set(mensajeDeError(err));
      },
    });
  }
}

function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isUnauthorized) return 'Correo o contraseña incorrectos.';
    if (err.isNetwork) return 'No hay conexión con el servidor. ¿Está el backend corriendo?';
    return err.message;
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}
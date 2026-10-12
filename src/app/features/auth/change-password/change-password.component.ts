import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, minLength, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { ApiError } from '../../../core/models/error.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { errorDe as mensajeDe, esInvalido } from '../../../shared/utils/form-helpers';

type ChangePasswordModel = { current_password: string; new_password: string; confirm: string };

/**
 * Cambio de contraseña del usuario autenticado.
 *
 * `confirm` es un campo SOLO de cliente: el backend solo recibe
 * `current_password` y `new_password`. Se valida en el schema del form.
 */
@Component({
  selector: 'sw-change-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password.component.html',
  imports: [ButtonComponent, IconComponent, FormField],
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly model = signal<ChangePasswordModel>({
    current_password: '',
    new_password: '',
    confirm: '',
  });

  readonly form = form(this.model, (f) => {
    required(f.current_password, { message: 'Ingresa tu contraseña actual.' });
    required(f.new_password, { message: 'Ingresa la nueva contraseña.' });
    minLength(f.new_password, 8, { message: 'Mínimo 8 caracteres.' });
    required(f.confirm, { message: 'Repite la nueva contraseña.' });

    // Validación cruzada: `ctx.valueOf` lee OTRO campo del mismo formulario,
    // que es como se hace aquí (no hay un `.validate()` sobre el campo).
    validate(f.confirm, (ctx) =>
      ctx.valueOf(f.new_password) === ctx.value()
        ? null
        : { kind: 'no-coincide', message: 'Las contraseñas no coinciden.' },
    );
  });

  readonly currentField = this.form.current_password;
  readonly newField = this.form.new_password;
  readonly confirmField = this.form.confirm;

  protected readonly cargando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly exito = signal(false);

  /** Errores inline por campo (solo si el usuario ya los tocó). */
  protected readonly errorActual = () => mensajeDe(this.form.current_password);
  protected readonly errorNueva = () => mensajeDe(this.form.new_password);
  protected readonly errorConfirmar = () => mensajeDe(this.form.confirm);
  protected readonly actualInvalido = () => esInvalido(this.form.current_password);
  protected readonly nuevaInvalido = () => esInvalido(this.form.new_password);
  protected readonly confirmarInvalido = () => esInvalido(this.form.confirm);

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.errorServidor.set(null);
    this.exito.set(false);

    void submit(this.form, async () => {
      this.cargando.set(true);
      const { current_password, new_password } = this.model();

      this.auth.changePassword({ current_password, new_password }).subscribe({
        next: () => {
          this.cargando.set(false);
          this.exito.set(true);
          this.notify.success('Contraseña actualizada correctamente.');
          this.limpiar();
        },
        error: (err: unknown) => {
          this.cargando.set(false);
          this.errorServidor.set(mensaje(err));
        },
      });
    });
  }

  private limpiar(): void {
    this.model.set({ current_password: '', new_password: '', confirm: '' });
  }

  protected volver(): void {
    void this.router.navigate(['/dashboard']);
  }
}

function mensaje(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isUnauthorized) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (err.status === 400 || err.status === 422) {
      return err.message || 'La contraseña actual no es correcta.';
    }
    return err.message;
  }
  return 'No se pudo cambiar la contraseña.';
}
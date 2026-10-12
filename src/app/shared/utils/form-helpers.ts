import type { Field, FieldState } from '@angular/forms/signals';

/**
 * Utilidades para Signal Forms que se usan igual en todos los formularios.
 *
 * En Signal Forms, `form.email` es un `Field` (una función); el estado real
 * (`touched`, `invalid`, `errors`) vive en el `FieldState` que devuelve al
 * invocarla. Estas funciones evitan repetir `campo()` en cada template.
 */

/**
 * Mensaje del primer error de un campo, pero solo si el usuario ya lo tocó.
 *
 * Mostrar el error de un campo que el usuario aún no ha escrito es ruido;
 * mostrarlo tras `submit()` es información.
 */
export function errorDe(campo: Field<string | number | boolean | null>): string | null {
  const state = campo() as FieldState<unknown>;
  if (!state.touched() || !state.invalid()) return null;
  return state.errors()[0]?.message ?? 'Valor inválido.';
}

/** ¿El campo es inválido Y ya fue tocado? Para `aria-invalid`. */
export function esInvalido(campo: Field<string | number | boolean | null>): boolean {
  const state = campo() as FieldState<unknown>;
  return state.invalid() && state.touched();
}
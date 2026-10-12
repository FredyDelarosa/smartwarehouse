import { Service, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sw.theme';

/**
 * Tema claro/oscuro con persistencia.
 *
 * Sin flash en la primera carga: `index.html` trae `data-theme="light"` y
 * este servicio corrige en el primer tick si había preferencia guardada.
 * Se respeta `prefers-color-scheme` cuando el usuario nunca eligió nada.
 */
@Service()
export class ThemeService {
  private readonly _theme = signal<Theme>(this.readInitial());

  readonly theme = this._theme.asReadonly();
  readonly esOscuro = () => this._theme() === 'dark';

  constructor() {
    effect(() => {
      const value = this._theme();
      document.documentElement.dataset['theme'] = value;
      localStorage.setItem(STORAGE_KEY, value);
    });
  }

  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  private readInitial(): Theme {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado === 'light' || guardado === 'dark') return guardado;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
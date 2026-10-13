import { Injectable } from '@angular/core';

/**
 * Versión de la build, visible para el usuario.
 *
 * ## Por qué existe
 *
 * Una PWA con service worker hace que "he actualizado y sigue igual" sea
 * imposible de diagnosticar: el navegador sigue sirviendo la versión anterior
 * hasta la segunda recarga, y el usuario no tiene ninguna forma de saber cuál
 * tiene. En soporte, la primera pregunta siempre es la misma: *¿qué versión
 * ves?*.
 *
 * ## De dónde sale
 *
 * Se lee del nombre del bundle principal que el navegador ya cargó — Angular
 * lo emite como `main-<hash>.js`. No hace falta ningún paso de build ni
 * variable inyectada: lo que se ve en pantalla es exactamente el código que se
 * está ejecutando, que es justo lo que hay que verificar.
 *
 * En desarrollo no hay hash, así que se muestra `dev`.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  /** Hash corto de la build, p. ej. `a1b2c3d4`, o `dev` en local. */
  readonly build: string;

  constructor() {
    this.build = VersionService.detectar();
  }

  private static detectar(): string {
    if (typeof document === 'undefined') return 'dev';
    // El <script type="module"> principal es el único con este patrón.
    for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))) {
      const m = /main-([A-Za-z0-9]{8,})\.js$/.exec(s.src);
      if (m?.[1]) return m[1];
    }
    return 'dev';
  }
}
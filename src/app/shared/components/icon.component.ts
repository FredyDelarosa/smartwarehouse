import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Icono SVG inline del set de la casa.
 *
 * Por qué inline y no una librería de iconos:
 *  - sin dependencias ni build extra,
 *  - hereda `currentColor` y el tamaño del texto,
 *  - se puede estilizar con `stroke-width` desde Tailwind.
 *
 * Los iconos decorativos llevan `aria-hidden` porque el texto al lado ya
 * aporta el significado; los que no, el consumidor les pasa `label`.
 */
export type IconName =
  | 'buscar'
  | 'paquete'
  | 'ubicacion'
  | 'inventario'
  | 'movimiento'
  | 'incidencia'
  | 'grafico'
  | 'panel'
  | 'usuario'
  | 'salir'
  | 'menu'
  | 'cerrar'
  | 'flecha-derecha'
  | 'flecha-izquierda'
  | 'flecha-abajo'
  | 'mas'
  | 'editar'
  | 'borrar'
  | 'qr'
  | 'check'
  | 'alerta'
  | 'info'
  | 'reloj'
  | 'descargar'
  | 'sol'
  | 'luna'
  | 'filtro'
  | 'vacio'
  | 'cargando'
  | 'escudo'
  | 'contrasena'
  | 'sin-permiso';

const PATHS: Record<IconName, string> = {
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  paquete:
    'M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  ubicacion:
    'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  inventario:
    'M4 7h16M4 12h16M4 17h16M8 4v16M4 4h16v16H4z',
  movimiento: 'M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3',
  incidencia:
    'M12 9v4m0 4h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  grafico: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  panel: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 0v14m6-14v14',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
  salir: 'M15 12H3m0 0 4-4m-4 4 4 4m8-9V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'm6 6 12 12M18 6 6 18',
  'flecha-derecha': 'M5 12h14m0 0-5-5m5 5-5 5',
  'flecha-izquierda': 'M19 12H5m0 0 5-5m-5 5 5 5',
  'flecha-abajo': 'm6 9 6 6 6-6',
  mas: 'M12 5v14M5 12h14',
  editar: 'M4 20h4L20 8l-4-4L4 16v4Zm10-14 4 4',
  borrar: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h3v3h-3v-3Zm3-3h3v3m-3-3v-3m3 6v-3',
  check: 'm5 13 4 4L19 7',
  alerta: 'M12 9v4m0 4h.01M12 3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L12 3Z',
  info: 'M12 11v5m0-8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  reloj: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  descargar: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 18v-2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  luna: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  filtro: 'M4 6h16M7 12h10m-7 6h4',
  vacio: 'M3 7h18v13H3zM3 7l3-4h12l3 4M9 12h6',
  cargando: 'M12 3a9 9 0 1 0 9 9',
  escudo: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z',
  contrasena: 'M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  'sin-permiso': 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3ZM9 9l6 6m0-6-6 6',
};

@Component({
  selector: 'sw-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : label()"
      class="shrink-0"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(20);
  readonly strokeWidth = input<number>(1.75);
  /**
   * true (default) → aria-hidden: el icono no aporta información porque hay
   * texto al lado. Ponlo en false si el icono ES el único contenido y
   * entonces `label()` es obligatorio.
   */
  readonly decorative = input<boolean>(true);
  readonly label = input<string>('');

  path(): string {
    return PATHS[this.name()] ?? PATHS['info'];
  }
}
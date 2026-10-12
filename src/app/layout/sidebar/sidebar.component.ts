import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent, type IconName } from '../../shared/components/icon.component';

export type NavItem = {
  path: string;
  label: string;
  icon: IconName;
  /** Coincidencia exacta de ruta (para /dashboard, que es prefijo de otras). */
  exact?: boolean;
  /** Contador opcional (alertas de stock, incidencias abiertas). */
  badge?: number | null;
};

export type NavGroup = {
  titulo: string;
  items: NavItem[];
};

/**
 * Navegación principal.
 *
 * En escritorio es una columna fija. En móvil es un drawer con overlay:
 * cierra con Escape, con click fuera, y devuelve el foco al botón que lo
 * abrió. El enlace activo se marca con `aria-current="page"` (lo pone
 * RouterLinkActive), no solo con color.
 */
@Component({
  selector: 'sw-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Drawer móvil -->
    @if (abierto()) {
      <div
        class="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
        (click)="cerrar.emit()"
        aria-hidden="true"
      ></div>
    }

    <aside
      [attr.aria-hidden]="null"
      [class]="panelClasses()"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div class="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <span
          class="flex size-7 items-center justify-center rounded-md bg-primary text-on-primary"
          aria-hidden="true"
        >
          <sw-icon name="paquete" [size]="17" [strokeWidth]="2" />
        </span>
        <span class="text-sm font-semibold tracking-tight text-foreground">SmartWarehouse</span>

        <button
          type="button"
          (click)="cerrar.emit()"
          class="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-surface-sunken lg:hidden"
          aria-label="Cerrar menú"
        >
          <sw-icon name="cerrar" [size]="18" />
        </button>
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        @for (group of grupos(); track group.titulo) {
          <div>
            <p class="sw-eyebrow px-3 pb-1.5">{{ group.titulo }}</p>
            <ul class="space-y-0.5">
              @for (item of group.items; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive="sw-nav-link-active"
                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                    class="sw-nav-link"
                    (click)="cerrar.emit()"
                  >
                    <sw-icon [name]="item.icon" [size]="18" />
                    <span class="flex-1 truncate">{{ item.label }}</span>
                    @if (item.badge; as badge) {
                      <span
                        class="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      >
                        {{ badge }}
                      </span>
                    }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </aside>
  `,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class SidebarComponent {
  readonly abierto = input<boolean>(false);
  readonly grupos = input.required<NavGroup[]>();
  readonly cerrar = output<void>();

  panelClasses(): string {
    return [
      'fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col',
      'border-r border-border bg-surface transition-transform duration-200 ease-out',
      // En escritorio deja de ser `fixed` y pasa a ocupar la columna: necesita
      // altura explícita o el nav se corta al contenido.
      'lg:static lg:inset-y-auto lg:z-auto lg:h-dvh lg:translate-x-0',
      this.abierto() ? 'translate-x-0 shadow-overlay' : '',
    ].join(' ');
  }

  onEscape(): void {
    if (this.abierto()) this.cerrar.emit();
  }
}
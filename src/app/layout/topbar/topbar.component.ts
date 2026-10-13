import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/store/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { VersionService } from '../../core/services/version.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/icon.component';
import { BadgeComponent } from '../../shared/components/badge.component';

/**
 * Barra superior: búsqueda rápida, tema, menú de usuario.
 *
 * Incluye un "skip link" al contenido: en teclado, el primer Tab lleva
 * directo al contenido principal y no hay que atravesar la navegación.
 */
@Component({
  selector: 'sw-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#contenido" class="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary">
      Saltar al contenido
    </a>

    <header
      class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur sm:px-4"
    >
      <button
        type="button"
        (click)="menu.emit()"
        class="-ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground lg:hidden"
        aria-label="Abrir menú de navegación"
        [attr.aria-expanded]="menuOpen()"
      >
        <sw-icon name="menu" [size]="20" />
      </button>

      <form class="min-w-0 flex-1" (submit)="onBuscar($event)" role="search">
        <label class="relative block max-w-md">
          <span class="sr-only-focusable">Buscar producto</span>
          <sw-icon
            name="buscar"
            [size]="16"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground"
          />
          <input
            type="search"
            name="q"
            [value]="termino()"
            (input)="onTermino($event)"
            placeholder="Buscar producto para localizar…"
            autocomplete="off"
            class="sw-input pl-9"
          />
        </label>
      </form>

      <button
        type="button"
        (click)="alternarTema()"
        class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
        [attr.aria-label]="tema() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
      >
        <sw-icon [name]="tema() === 'dark' ? 'sol' : 'luna'" [size]="18" />
      </button>

      <div class="relative">
        <button
          type="button"
          (click)="menuUsuario.set(!menuUsuario())"
          class="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-sunken"
          [attr.aria-expanded]="menuUsuario()"
          aria-haspopup="menu"
        >
          <span
            class="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary"
            aria-hidden="true"
          >
            {{ store.iniciales() }}
          </span>
          <span class="hidden min-w-0 text-left sm:block">
            <span class="block truncate text-xs font-medium leading-tight text-foreground">
              {{ store.user()?.nombre ?? 'Invitado' }}
            </span>
            <span class="block truncate text-[11px] leading-tight text-muted-foreground">
              {{ store.rolNombre() ?? '—' }}
            </span>
          </span>
          <sw-icon name="flecha-abajo" [size]="14" class="text-muted-foreground" />
        </button>

        @if (menuUsuario()) {
          <div
            (click)="cerrarMenuUsuario()"
            class="fixed inset-0 z-10"
            aria-hidden="true"
          ></div>
          <div
            role="menu"
            class="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-raised"
          >
            <div class="border-b border-border px-3 py-2.5">
              <p class="truncate text-sm font-medium text-foreground">
                {{ store.user()?.nombre }}
              </p>
              <p class="truncate text-xs text-muted-foreground">{{ store.user()?.email }}</p>
              <sw-badge class="mt-2" tone="info" size="sm">
                {{ store.rolNombre() }}
              </sw-badge>
            </div>
            <a
              [routerLink]="['/mi-cuenta']"
              (click)="cerrarMenuUsuario()"
              role="menuitem"
              class="sw-nav-link m-1.5"
            >
              <sw-icon name="escudo" [size]="16" />
              Cambiar contraseña
            </a>
            <div class="border-t border-border px-4 py-2.5">
              <!--
                Versión en pantalla. Sin esto no hay forma de saber qué
                versión está cargada en un dispositivo concreto: el service
                worker sirve la anterior hasta la segunda recarga, así que
                "he actualizado y sigue igual" no se puede diagnosticar. Es la
                primera pregunta que hay que hacer antes de depurar nada más.
              -->
              <p class="text-[11px] text-muted-foreground">
                Versión
                <span class="font-mono text-foreground">{{ version }}</span>
              </p>
            </div>
            <button
              type="button"
              (click)="salir()"
              role="menuitem"
              class="sw-nav-link m-1.5 w-full text-danger"
            >
              <sw-icon name="salir" [size]="16" />
              Cerrar sesión
            </button>
          </div>
        }
      </div>
    </header>
  `,
  imports: [RouterLink, IconComponent, BadgeComponent],
})
export class TopbarComponent {
  readonly store = inject(AuthStore);
  /** Se muestra en el menú de usuario para poder diagnosticar versiones. */
  readonly version = inject(VersionService).build;
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly menu = output<void>();
  readonly menuOpen = input<boolean>(false);
  readonly menuUsuario = signal(false);

  readonly termino = signal('');
  readonly tema = this.theme.theme;

  /** Ir al flujo de búsqueda con lo que el usuario escribió arriba. */
  onBuscar(event: Event): void {
    event.preventDefault();
    const valor = this.termino().trim();
    if (!valor) return;
    this.termino.set('');
    void this.router.navigate(['/busquedas'], { queryParams: { q: valor } });
  }

  onTermino(event: Event): void {
    this.termino.set((event.target as HTMLInputElement).value);
  }

  alternarTema(): void {
    this.theme.toggle();
  }

  cerrarMenuUsuario(): void {
    this.menuUsuario.set(false);
  }

  salir(): void {
    this.cerrarMenuUsuario();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
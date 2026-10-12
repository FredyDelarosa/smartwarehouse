import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthStore } from '../../core/store/auth.store';
import { SidebarComponent, type NavGroup } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ToastContainerComponent } from '../../shared/components/toast-container.component';

/**
 * Shell de la aplicación: sidebar + topbar + contenido.
 *
 * Los enlaces de navegación se filtran por rol aquí, en un único sitio.
 * El backend sigue validando: esto solo evita mostrar lo que el usuario no
 * puede hacer (y por eso el comment es "UI, no autorización").
 */
@Component({
  selector: 'sw-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh bg-background">
      <sw-sidebar
        [abierto]="menuAbierto()"
        [grupos]="navGroups()"
        (cerrar)="menuAbierto.set(false)"
      />

      <div class="flex min-w-0 flex-1 flex-col">
        <sw-topbar [menuOpen]="menuAbierto()" (menu)="menuAbierto.set(true)" />

        <main id="contenido" class="flex-1 focus:outline-none">
          <router-outlet />
        </main>
      </div>
    </div>

    <sw-toast-container />
  `,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastContainerComponent],
})
export class MainLayoutComponent {
  private readonly store = inject(AuthStore);

  readonly menuAbierto = signal(false);

  readonly navGroups = computed<NavGroup[]>(() => {
    const esSupervision =
      this.store.hasRol('Administrador', 'Supervisor') ||
      this.store.can('metricas:ver');

    const principal: NavGroup = {
      titulo: 'Operación',
      items: [
        { path: '/dashboard', label: 'Panel', icon: 'panel', exact: true },
        { path: '/busquedas', label: 'Buscar producto', icon: 'buscar' },
        { path: '/inventario', label: 'Inventario', icon: 'inventario' },
        { path: '/movimientos', label: 'Movimientos', icon: 'movimiento' },
        { path: '/incidencias', label: 'Incidencias', icon: 'incidencia' },
      ],
    };

    const catalogo: NavGroup = {
      titulo: 'Catálogo',
      items: [
        { path: '/productos', label: 'Productos', icon: 'paquete' },
        { path: '/ubicaciones', label: 'Ubicaciones', icon: 'ubicacion' },
        { path: '/escaner', label: 'Escanear QR', icon: 'qr' },
      ],
    };

    const analisis: NavGroup = {
      titulo: 'Análisis',
      // Indicadores de gestión: solo quien puede verlos tiene sentido que los vea.
      items: esSupervision
        ? [{ path: '/metricas', label: 'Métricas', icon: 'grafico' }]
        : [],
    };

    return [principal, catalogo, analisis].filter((g) => g.items.length > 0);
  });
}
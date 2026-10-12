import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Componente raíz: solo el `router-outlet`.
 * El shell (sidebar/topbar) vive en `MainLayoutComponent`.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
  imports: [RouterOutlet],
})
export class AppComponent {}
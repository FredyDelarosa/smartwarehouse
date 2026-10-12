import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => {
  // Si el bootstrap falla, no hay UI que muestre el error: al menos queda
  // en la consola para diagnóstico.
  console.error('[SmartWarehouse] No se pudo iniciar la aplicación:', err);
});
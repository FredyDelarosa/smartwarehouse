import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

import { NotificationService } from './notification.service';

/**
 * Aviso de "hay una versión nueva disponible" (Fase 4.1 del plan).
 *
 * ## Por qué NO se recarga solo
 *
 * Un service worker que se actualiza sin preguntar puede tirar por tierra el
 * trabajo a medio hacer: el trabajador ha abierto una incidencia, ha escrito un
 * movimiento y, al recargar, se pierde. En un almacén eso es media hora de
 * rehacer trabajo de picking, así que aquí la decisión siempre es del usuario.
 *
 * ## El detalle que hace esto seguro
 *
 * Angular no activa la versión nueva hasta la siguiente carga completa. El
 * flujo es: se descarga en segundo plano → se avisa → el usuario pulsa
 * "Actualizar" → `activateUpdate()` → `location.reload()`. Nunca se corta una
 * pantalla a la mitad.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly notify = inject(NotificationService);

  private conectado = false;

  /**
   * Se engancha a `versionUpdates` una sola vez al arrancar.
   *
   * En desarrollo `SwUpdate.isEnabled` es `false` porque no hay service worker
   * compilado, así que esto ya es un no-op sin falta de un `isDevMode()`.
   */
  iniciar(): void {
    if (this.conectado || !this.swUpdate.isEnabled) return;
    this.conectado = true;

    // Camino normal: el SW detecta el bundle nuevo en segundo plano y avisa.
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.ofrecerActualizacion());

    // Red de seguridad. `versionUpdates` no emite en la carga en la que el SW
    // se acaba de instalar, así que una comprobación explícita cubre ese
    // hueco. Se hace una sola vez, tras 4 s, para no competir con el arranque.
    setTimeout(() => void this.comprobar(), 4000);
  }

  /** Consulta si hay una versión pendiente y avisa. */
  private async comprobar(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    try {
      if (await this.swUpdate.checkForUpdate()) this.ofrecerActualizacion();
    } catch {
      // Sin red o con un SW que no responde: no es un fallo de la app, y
      // un toast de error por esto solo confundiría al usuario.
    }
  }

  private ofrecerActualizacion(): void {
    this.notify.info('Hay una versión nueva disponible.', {
      label: 'Actualizar',
      run: () => void this.actualizar(),
    });
  }

  /** Activa la versión descargada y recarga. */
  private async actualizar(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    await this.swUpdate.activateUpdate();
    // `location` a propósito: el router no sabe recargar el documento, y con
    // `reload(1)` se perdería la pantalla de la que venía el usuario.
    location.reload();
  }
}
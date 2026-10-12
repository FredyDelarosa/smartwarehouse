import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { UbicacionesService } from '../ubicaciones.service';

/**
 * Escáner de códigos QR sin dependencias.
 *
 * Usa la API nativa `BarcodeDetector` (Chrome/Android, Edge, Safari 17+).
 * Cuando NO está disponible, la pantalla NO se rompe: ofrece escribir el
 * código a mano, que además es el caso real cuando la cámara está rota, hay
 * suciedad en el lente o el usuario lleva guantes.
 *
 * ⚠️ `getUserMedia` exige contexto seguro: en producción sirve por HTTPS; en
 * desarrollo Angular sirve por HTTP en localhost, que sí cuenta como seguro.
 *
 * Devolver de la ruta `/escaner`: reutiliza el layout principal.
 */
@Component({
  selector: 'sw-escaner-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './escaner-qr.component.html',
  imports: [ButtonComponent, IconComponent, RouterLink],
})
export class EscanerQrComponent implements OnDestroy {
  private readonly ubicaciones = inject(UbicacionesService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private detector: BarcodeDetector | null = null;

  /** ¿El navegador implementa la API nativa de lectura de QR? */
  protected readonly soportado = 'BarcodeDetector' in globalThis;
  protected readonly activo = signal(false);
  protected readonly permisoDenegado = signal(false);
  protected readonly errorCamara = signal<string | null>(null);
  protected readonly codigoManual = signal('');
  protected readonly procesando = signal(false);

  /** El video se muestra dentro de un contenedor con ratio fijo 1:1 (cámara trasera). */
  protected readonly ultimoCodigo = signal<string | null>(null);

  protected iniciarCamara(): void {
    this.errorCamara.set(null);
    this.permisoDenegado.set(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no permite usar la cámara. Escribe el código a mano.');
      return;
    }

    // Preferred: environment-facing para poder leer el QR pegado en el estante.
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((stream) => {
        this.stream = stream;
        const video = this.videoRef()?.nativeElement;
        if (video) {
          video.srcObject = stream;
          void video.play();
        }
        this.activo.set(true);
        this.detector = this.crearDetector();
        this.escanearEnBucle();
      })
      .catch((err: unknown) => {
        const nombre = err instanceof DOMException ? err.name : '';
        if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
          this.permisoDenegado.set(true);
        } else {
          this.errorCamara.set('No se pudo acceder a la cámara. Revisa que no esté en uso.');
        }
      });
  }

  protected detenerCamara(): void {
    this.activo.set(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Ciclo de lectura con `BarcodeDetector`. Ligero: no bloquea la UI. */
  private escanearEnBucle(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.activo() || !this.detector) return;

    if (video.readyState < 2) {
      this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
      return;
    }

    this.detector
      .detect(video)
      .then((codigos: DetectedBarcode[]) => {
        const codigo = codigos[0]?.rawValue;
        if (codigo) {
          this.procesando.set(true);
          this.consultar(codigo);
          return; // Paramos el bucle: esperamos a resolver la consulta.
        }
        this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
      })
      .catch(() => {
        // Un frame ilegible es normal; seguimos intentando.
        this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
      });
  }

  private crearDetector(): BarcodeDetector | null {
    if (!('BarcodeDetector' in globalThis)) return null;
    try {
      return new BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      // Algunos navegadores aceptan la clase pero no el formato pedido.
      return null;
    }
  }

  /** Busca la ubicación por QR y navega a su detalle. */
  protected consultar(codigo: string): void {
    const limpio = codigo.trim();
    if (!limpio || this.procesando()) return;

    this.ultimoCodigo.set(limpio);
    this.ubicaciones.porQr(limpio).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.detenerCamara();
        // Mandamos al detalle de la ubicación escaneada.
        void this.router.navigate(['/ubicaciones', res.ubicacion.id]);
      },
      error: (err: unknown) => {
        this.procesando.set(false);
        this.notify.apiError(err, `Código QR no reconocido: ${limpio}`);
      },
    });
  }

  protected buscarManual(event: Event): void {
    event.preventDefault();
    this.consultar(this.codigoManual());
  }

  protected onManual(event: Event): void {
    this.codigoManual.set((event.target as HTMLInputElement).value);
  }

  /** Ciclo de vida: si se navega fuera con la cámara activa, se apaga. */
  ngOnDestroy(): void {
    this.detenerCamara();
  }
}
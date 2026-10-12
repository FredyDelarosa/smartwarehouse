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
 * Escáner de códigos QR con doble decodificador.
 *
 * ## Por qué hay dos
 *
 * La API nativa `BarcodeDetector` es rápida, pero **solo existe en Chromium**
 * (Chrome y Edge). En Firefox, en Safari y en Chrome sobre Linux no está
 * disponible, y el escáner se quedaba mudo: la cámara se abría, el vídeo salía
 * negro y no pasaba nada, sin explicar por qué. Ese es exactamente el fallo que
 * se reportó en producción.
 *
 * Así que ahora hay dos rutas:
 *   1. `BarcodeDetector` si existe — va por GPU, es la más rápida.
 *   2. **jsQR** sobre un `<canvas>`, cargado bajo demanda. Funciona en cualquier
 *      navegador con canvas, que es todos los que la app soporta.
 *
 * Si el nativo falla o no está, se cae al segundo **sin que el usuario lo note**
 * y se muestra en el diagnóstico qué decodificador está activo.
 *
 * jsQR se importa con `await import()` para que sus ~250 KB (sin comprimir) no
 * entren en el bundle inicial: solo se descargan al abrir el escáner.
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
  private decodificarJsQr: typeof import('jsqr').default | null = null;
  private lienzo: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  /**
   * Ya no bloqueamos la cámara si falta el soporte nativo: el respaldo por
   * canvas funciona siempre. El indicador se mantiene para diagnóstico.
   */
  protected readonly soportadoNativo = 'BarcodeDetector' in globalThis;

  protected readonly activo = signal(false);
  protected readonly permisoDenegado = signal(false);
  protected readonly errorCamara = signal<string | null>(null);
  protected readonly codigoManual = signal('');
  protected readonly procesando = signal(false);
  protected readonly ultimoCodigo = signal<string | null>(null);

  /**
   * Diagnóstico en pantalla. Sin esto, un fallo de cámara y un QR simplemente
   * fuera de plano se ven IGUAL: una pantalla negra. Con esto se distinguen.
   */
  protected readonly diagnostico = signal<{
    decodificador: 'nativo' | 'jsQR' | 'pendiente';
    resolucion: string;
    fotogramas: number;
    fotogramasDetectados: number;
    pista: string;
  } | null>(null);

  private readonly fotogramas = signal(0);

  protected iniciarCamara(): void {
    this.errorCamara.set(null);
    this.permisoDenegado.set(false);
    this.fotogramas.set(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no permite usar la cámara. Escribe el código a mano.');
      return;
    }

    // Preferred: environment-facing para poder leer el QR pegado en el estante.
    // `ideal` (no `exact`) porque en un portátil no hay cámara trasera y, si se
    // exige, el navegador falla en vez de usar la frontal.
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((stream) => {
        this.stream = stream;
        const video = this.videoRef()?.nativeElement;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
        this.activo.set(true);
        this.prepararDecodificacion().then(() => this.escanearEnBucle());
      })
      .catch((err: unknown) => {
        const nombre = err instanceof DOMException ? err.name : '';
        if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
          this.permisoDenegado.set(true);
        } else if (nombre === 'NotFoundError') {
          this.errorCamara.set('No se encontró ninguna cámara en el dispositivo.');
        } else if (nombre === 'NotReadableError') {
          this.errorCamara.set(
            'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.',
          );
        } else {
          this.errorCamara.set('No se pudo acceder a la cámara. Revisa que no esté en uso.');
        }
      });
  }

  protected detenerCamara(): void {
    this.activo.set(false);
    this.diagnostico.set(null);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.detector = null;
    this.decodificarJsQr = null;
  }

  /**
   * Decide el decodificador y deja listo el canvas de reserva.
   *
   * Se intenta primero el nativo. Si no existe, o si el navegador lo acepta
   * pero falla al detectar, `degradar()` pasa a jsQR.
   */
  private async prepararDecodificacion(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video) return;

    if (this.soportadoNativo) {
      try {
        this.detector = new BarcodeDetector({ formats: ['qr_code'] });
        this.actualizarDiagnostico('nativo');
        return;
      } catch {
        // Acepta la clase pero no el formato: seguimos al respaldo.
        this.detector = null;
      }
    }

    await this.cargarJsQr(video);
  }

  /** Carga perezosa de jsQR y prepara el canvas donde se dibujará cada frame. */
  private async cargarJsQr(video: HTMLVideoElement): Promise<void> {
    this.lienzo = document.createElement('canvas');
    this.ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
    try {
      const mod = await import('jsqr');
      this.decodificarJsQr = mod.default;
      this.actualizarDiagnostico('jsQR');
    } catch {
      this.decodificarJsQr = null;
      this.actualizarDiagnostico('pendiente');
    }
  }

  /** Vuelve al decodificador por canvas tras fallos repetidos del nativo. */
  private degradarAJsQr(): void {
    if (this.detector === null && this.decodificarJsQr !== null) return;
    this.detector = null;
    const video = this.videoRef()?.nativeElement;
    if (!this.ctx && video) void this.cargarJsQr(video);
    else this.actualizarDiagnostico('jsQR');
  }

  private actualizarDiagnostico(decodificador: 'nativo' | 'jsQR' | 'pendiente'): void {
    const video = this.videoRef()?.nativeElement;
    this.diagnostico.set({
      decodificador,
      resolucion: video && video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : '—',
      fotogramas: this.fotogramas(),
      fotogramasDetectados: 0,
      pista: '',
    });
  }

  /** Ciclo de lectura. Ligero: no bloquea la UI. */
  private escanearEnBucle(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.activo()) return;

    // Sin fotogramas todavía: reintento sin consumir CPU en detect().
    if (video.readyState < 2 || video.videoWidth === 0) {
      this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
      return;
    }

    if (this.detector) {
      this.detector
        .detect(video)
        .then((codigos: DetectedBarcode[]) => {
          const codigo = codigos[0]?.rawValue;
          if (codigo) return this.procesar(codigo);
          this.contarFrame();
          this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
        })
        .catch(() => {
          // El nativo puede existir y aun así fallar (permisos, GPU, driver).
          // No es motivo para dejar al usuario con una pantalla negra.
          this.degradarAJsQr();
          this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
        });
      return;
    }

    if (this.decodificarJsQr && this.ctx && this.lienzo) {
      // jsQR es de CPU: se reduce a media frecuencia (cada 3 frames) para no
      // dejar el ventilador del portátil chillando en un almacén.
      if (this.fotogramas() % 3 === 0) {
        const v = video.videoWidth;
        const h = video.videoHeight;
        // 480 px es de sobra para un QR de estante y mantiene el coste bajo.
        const escala = Math.min(1, 480 / Math.max(v, h));
        this.lienzo.width = Math.round(v * escala);
        this.lienzo.height = Math.round(h * escala);
        this.ctx.drawImage(video, 0, 0, this.lienzo.width, this.lienzo.height);
        const datos = this.ctx.getImageData(0, 0, this.lienzo.width, this.lienzo.height);
        // jsQR recibe el array de píxeles y las dimensiones, no el ImageData.
        // `attemptBothOrientations` cubre QRs girados, algo normal si el
        // trabajador inclina el dispositivo.
        const r = this.decodificarJsQr(datos.data, datos.width, datos.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (r?.data) return this.procesar(r.data);
      }
      this.contarFrame();
      this.rafId = requestAnimationFrame(() => this.escanearEnBucle());
      return;
    }

    // Ningún decodificador disponible: no se puede escanear.
    this.errorCamara.set(
      'Este navegador no puede leer códigos QR. Escribe el código a mano abajo.',
    );
    this.activo.set(false);
  }

  private contarFrame(): void {
    const n = this.fotogramas() + 1;
    this.fotogramas.set(n);
    this.diagnostico.update((d) => (d ? { ...d, fotogramas: n, resolucion: this.resolucionActual() } : d));
  }

  private resolucionActual(): string {
    const v = this.videoRef()?.nativeElement;
    return v && v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : '—';
  }

  /** Se llama cuando el `<video>` ya tiene dimensiones listas. */
  protected onVideoListo(): void {
    this.diagnostico.update((d) =>
      d ? { ...d, resolucion: this.resolucionActual() } : d,
    );
  }

  private procesar(codigo: string): void {
    if (this.procesando()) return;
    this.procesando.set(true);
    this.consultar(codigo);
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
        void this.router.navigate(['/ubicaciones', res.ubicacion.id]);
      },
      error: (err: unknown) => {
        this.procesando.set(false);
        this.notify.apiError(err, `Código QR no reconocido: ${limpio}`);
      },
    });
  }

  protected onManual(event: Event): void {
    this.codigoManual.set((event.target as HTMLInputElement).value);
  }

  protected buscarManual(event: Event): void {
    event.preventDefault();
    this.consultar(this.codigoManual());
  }

  ngOnDestroy(): void {
    this.detenerCamara();
  }
}
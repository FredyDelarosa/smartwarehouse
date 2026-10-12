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
  /** Id del temporizador del bucle. Es un setTimeout, NO un requestAnimationFrame. */
  private timerId: ReturnType<typeof setTimeout> | null = null;

  /** Tope de seguridad: `detect()` puede no resolver ni rechazar nunca. */
  private topeDeteccion: ReturnType<typeof setTimeout> | null = null;
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
  protected readonly iniciando = signal(false);
  protected readonly permisoDenegado = signal(false);
  protected readonly errorCamara = signal<string | null>(null);
  protected readonly codigoManual = signal('');
  protected readonly procesando = signal(false);
  protected readonly ultimoCodigo = signal<string | null>(null);

  /**
   * Diagnóstico en pantalla. Sin esto, un fallo de cámara y un QR simplemente
   * fuera de plano se ven IGUAL: una pantalla negra. Y —peor— un bucle que
   * reintenta y falla en silencio también se veía igual, por eso se cuenta
   * también lo que falla y por qué.
   */
  protected readonly diagnostico = signal<{
    decodificador: 'nativo' | 'jsQR' | 'pendiente';
    resolucion: string;
    listo: boolean;
    pausado: boolean;
    intentos: number;
    leyendo: boolean;
    error: string;
  } | null>(null);


  protected iniciarCamara(): void {
    this.errorCamara.set(null);
    this.permisoDenegado.set(false);
    this.intentos = 0;
    this.ultimoError = '';
    this.iniciando.set(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no permite usar la cámara. Escribe el código a mano.');
      this.iniciando.set(false);
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
        // El <video> ya está en el DOM (oculto con CSS). Primero se muestra el
        // marco y EN UN FRAME DEJAS ENGANCHAR el stream: si se llama a play()
        // sobre un elemento `display:none`, hay navegadores que no arrancan la
        // reproducción y `videoWidth` se queda en 0 para siempre, que es
        // justo lo que hace que el bucle no llegue a detectar nada.
        this.activo.set(true);
        this.iniciando.set(false);

        requestAnimationFrame(() => {
          const video = this.videoRef()?.nativeElement;
          if (video) {
            video.srcObject = stream;
            void video.play().catch(() => undefined);
          }
          void this.prepararDecodificacion().then(() => this.escanearEnBucle());
        });
      })
      .catch((err: unknown) => {
        this.iniciando.set(false);
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
    if (this.timerId !== null) {
      // clearTimeout, NO cancelAnimationFrame: el bucle se programa con
      // setTimeout y cancelarAnimationFrame no lo detendría — el escáner
      // seguiría leyendo en segundo plano con la cámara ya apagada.
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.limpiarTope();
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
      resolucion: video?.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : '—',
      listo: false,
      pausado: video?.paused ?? true,
      intentos: this.intentos,
      leyendo: false,
      error: this.ultimoError,
    });
  }

  private limpiarTope(): void {
    if (this.topeDeteccion !== null) {
      clearTimeout(this.topeDeteccion);
      this.topeDeteccion = null;
    }
  }

  /**
   * Programa el siguiente intento.
   *
   * Se usa `setTimeout` y NO `requestAnimationFrame`: rAF se congela cuando la
   * pestaña pierde el foco o el dispositivo entra en reposo, y entonces el
   * escáner se quedaba congelado sin explicación (el típico "buscando…"
   * eterno). `setTimeout` sigue corriendo salvo que la página esté congelada
   * del todo por el sistema.
   */
  private programar(): void {
    this.timerId = setTimeout(() => this.escanearEnBucle(), 80);
  }

  /** Ciclo de lectura. No bloquea la UI. */
  private escanearEnBucle(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.activo()) return;

    const listo = video.readyState >= 2 && video.videoWidth > 0;
    this.registrarEstado(video, listo);

    if (!listo) {
      // Se cuenta como intento para que el diagnóstico no se quede en "0
      // fotogramas" cuando en realidad lo que falla es la señal de vídeo.
      this.contarIntento(false);
      this.programar();
      return;
    }

    this.contarIntento(true);

    if (this.detector) {
      this.detector
        .detect(video)
        .then((codigos: DetectedBarcode[]) => {
          this.limpiarTope();
          const codigo = codigos[0]?.rawValue;
          if (codigo) return this.procesar(codigo);
          this.programar();
        })
        .catch((err: unknown) => {
          this.limpiarTope();
          // El nativo puede existir y fallar en cada llamada (permisos, GPU,
           // driver). Cuenta como error y degrada; si no, el diagnóstico
          // mentiría mostrando "buscando" para siempre.
          this.ultimoError = err instanceof Error ? err.message : String(err);
          this.degradarAJsQr();
          this.programar();
        });
      // `detect()` puede quedarse COLGADO: devuelve una promesa que ni
      // resuelve ni rechaza. Sin este tope el bucle se para en silencio y la
      // pantalla se queda en "buscando" para siempre, sin avanzar ni fallar.
      // Al agotarse, se degrada al decodificador por software, que siempre
      // responde.
      this.topeDeteccion = setTimeout(() => {
        if (!this.activo() || this.detector === null) return;
        this.topeDeteccion = null;
        this.ultimoError = 'El lector nativo no respondió; se usa el de software.';
        this.degradarAJsQr();
        this.programar();
      }, 1200);
      return;
    }

    if (this.decodificarJsQr && this.ctx && this.lienzo) {
      const r = this.leerConJsQr(video);
      if (r?.data) return this.procesar(r.data);
      this.programar();
      return;
    }

    // Ningún decodificador listo todavía (jsQR se carga de forma asíncrona).
    // Se espera en vez de rendirse: da tiempo a que termine la carga perezosa.
    this.intentos++;
    this.registrarEstado(video, listo);
    if (this.intentos > 40) {
      this.errorCamara.set(
        'No se pudo preparar el lector de QR. Recarga la página o escribe el código a mano.',
      );
      this.activo.set(false);
      return;
    }
    this.programar();
  }

  /** Lee un frame con jsQR sobre el canvas. */
  private leerConJsQr(video: HTMLVideoElement): { data: string } | null {
    if (!this.ctx || !this.lienzo || !this.decodificarJsQr) return null;

    const v = video.videoWidth;
    const h = video.videoHeight;
    // 480 px de sobra para un QR de estante y mantiene bajo el coste de CPU.
    const escala = Math.min(1, 480 / Math.max(v, h));
    this.lienzo.width = Math.round(v * escala);
    this.lienzo.height = Math.round(h * escala);

    try {
      this.ctx.drawImage(video, 0, 0, this.lienzo.width, this.lienzo.height);
      const datos = this.ctx.getImageData(0, 0, this.lienzo.width, this.lienzo.height);
      // `attemptBoth` cubre QRs girados, algo normal si el trabajador inclina
      // el dispositivo.
      return this.decodificarJsQr(datos.data, datos.width, datos.height, {
        inversionAttempts: 'attemptBoth',
      });
    } catch (err) {
      // getImageData lanza si el lienzo está "tainted". Pasa si algún ajuste
      // del navegador bloquea la lectura del vídeo.
      this.ultimoError = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  /** Contador de intentos de lectura sobre frames con señal. */
  private intentos = 0;
  private ultimoError = '';

  private contarIntento(conFrame: boolean): void {
    this.intentos++;
    this.diagnostico.update((d) => (d ? { ...d, intentos: this.intentos, leyendo: conFrame } : d));
  }

  /** Refleja el estado real del `<video>` en el diagnóstico. */
  private registrarEstado(video: HTMLVideoElement, listo: boolean): void {
    this.diagnostico.update((d) =>
      d
        ? {
            ...d,
            resolucion: video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : '—',
            listo,
            pausado: video.paused,
            error: this.ultimoError,
          }
        : d,
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
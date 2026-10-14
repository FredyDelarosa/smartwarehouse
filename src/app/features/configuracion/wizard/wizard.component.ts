import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  LETRAS_ESTANTE,
  MAX_ESTANTES,
  MAX_NIVELES,
  MAX_PASILLOS,
  type Previsualizacion,
} from '../../../core/models/configuracion.model';
import { ApiError } from '../../../core/models/error.model';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ButtonComponent } from '../../../shared/components/button.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ConfiguracionWizardStore } from './wizard.store';

type Paso = 'almacen' | 'pasillos' | 'niveles' | 'fuera' | 'confirmar';

/**
 * Alta de almacén + definición de su layout, en un solo asistente.
 *
 * ## Por qué un asistente y no dos pantallas
 *
 * Las dos cosas van juntas de verdad: el cuestionario necesita un almacén
 * al que pertenece, y el almacén sin ubicaciones está vacío. Partirlas
 * obligaría al usuario a crear la cuenta, salir al panel y volver a entrar
 * para poder configurarlo — con la mitad de Probability de que no lo haga.
 *
 * ## Por qué la generación va al final, no en el paso 2
 *
 * Crear el almacén es instantáneo y reversible (se puede borrar y volver a
 * empezar). Crear 87 ubicaciones con sus QR no. Por eso el cuestionario se
 * responde entero en local y solo se escribe cuando el usuario ha visto la
 * tabla de lo que va a crearse y ha confirmado.
 *
 * ## Por qué el administrador se fija en el paso 1
 *
 * Porque es quien va a usar esto. Y porque el backend le asigna el rol de
 * Administrador sin pedirlo: no hay un desplegable de rol que alguien pueda
 * marcar por error.
 */
@Component({
  selector: 'sw-configuracion-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El store es `providedIn: 'root'`, pero se declara aquí para que quede
  // claro que esta pantalla es su dueña. Sin `providers`, Angular lo resolvería
  // por el environment injector y el error (NG0201) solo aparecería al navegar.
  providers: [ConfiguracionWizardStore],
  templateUrl: './wizard.component.html',
  imports: [ButtonComponent, IconComponent],
})
export class WizardComponent {
  protected readonly svc = inject(ConfiguracionService);
  protected readonly onboarding = inject(OnboardingService);
  protected readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(ConfiguracionWizardStore);

  protected readonly letras = LETRAS_ESTANTE;
  protected readonly maxEstantes = MAX_ESTANTES;
  protected readonly maxPasillos = MAX_PASILLOS;
  protected readonly maxNiveles = MAX_NIVELES;

  protected readonly paso = signal<Paso>('almacen');
  protected readonly cargando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly preview = signal<Previsualizacion | null>(null);
  protected readonly creado = signal<{ almacen: string; ubicaciones: number } | null>(null);

  /**
   * ¿El almacén ya existe?
   *
   * El mismo componente sirve para `/configuracion-inicial` (alta completa, el
   * usuario aún no tiene cuenta) y para `/almacen/configuracion` (ampliar un
   * almacén que ya tiene). Lo decide la ruta, no una señal que alguien pueda
   * dejar a medias.
   */
  protected readonly soloConfigurar = computed(
    () => this.route.snapshot.data['modo'] === 'configurar',
  );

  /** El alta tiene un paso más: el almacén y su administrador. */
  private readonly PASOS_ALTA: readonly { id: Paso; titulo: string }[] = [
    { id: 'almacen', titulo: 'Almacén' },
    { id: 'pasillos', titulo: 'Pasillos' },
    { id: 'niveles', titulo: 'Niveles' },
    { id: 'fuera', titulo: 'Fuera de servicio' },
    { id: 'confirmar', titulo: 'Confirmar' },
  ];

  private readonly PASOS_EXISTENTE: readonly { id: Paso; titulo: string }[] = [
    { id: 'pasillos', titulo: 'Pasillos' },
    { id: 'niveles', titulo: 'Niveles' },
    { id: 'fuera', titulo: 'Fuera de servicio' },
    { id: 'confirmar', titulo: 'Confirmar' },
  ];

  protected readonly pasos = computed(() =>
    this.soloConfigurar() ? this.PASOS_EXISTENTE : this.PASOS_ALTA,
  );

  /** Los mismos pasos, pero solo los que este modo puede visitar. */
  private readonly orden = computed<Paso[]>(() => this.pasos().map((p) => p.id));

  protected readonly indicePaso = computed(() => this.pasos().findIndex((p) => p.id === this.paso()));

  /** 1 de 5 … 5 de 5, en texto, para quien no lee la barra. */
  protected readonly pasoTexto = computed(() => `${this.indicePaso() + 1} de ${this.pasos().length}`);

  // Constructor PÚBLICO a propósito: `loadComponent` lo instancia Angular
  // desde fuera y un constructor `protected` hace que la ruta no compile
  // ("Cannot assign a 'protected' constructor type to a 'public' one").
  constructor() {
    // Un almacén recién creado llega sin pasillos; se ofrecen 2 por defecto
    // porque es lo mínimo razonable y se ven los dos nombres en pantalla.
    if (this.store.pasillos().length === 0) this.store.ajustarPasillos(2);
    // Quien ya tiene almacén no tiene nada que responder en el paso 1: se le
    // lleva directamente a donde está la decisión.
    if (this.soloConfigurar()) this.paso.set('pasillos');
  }

  // ── Navegación ──────────────────────────────────────────────────────
  protected siguiente(): void {
    const orden = this.orden();
    const i = orden.indexOf(this.paso());
    if (i < orden.length - 1) {
      this.paso.set(orden[i + 1]);
      // La previsualización se pide al ENTRAR en el último paso, no al pulsar
      // el botón: así la tabla de lo que se va a crear ya está en pantalla
      // cuando el usuario decide. Pedirla al confirmar la convertiría en un
      // salto de espera justo en el momento de decidir.
      if (orden[i + 1] === 'confirmar') this.pedirPrevisualizacion();
    }
  }

  protected atras(): void {
    const orden = this.orden();
    const i = orden.indexOf(this.paso());
    if (i > 0) this.paso.set(orden[i - 1]);
  }

  protected irA(p: Paso): void {
    // Solo hacia atrás, o hacia adelante si lo anterior está completo. Un
    // indicador de progreso por el que se pueda saltar al final sin haber
    // contestado nada es un indicador de progreso que miente.
    const destino = this.orden().indexOf(p);
    if (destino >= 0 && destino <= this.indicePaso()) this.paso.set(p);
  }

  // ── Validación del paso 1 ───────────────────────────────────────────
  protected readonly pasoAlmacenValido = computed(() => {
    // En modo configurar no hay nada que crear: el almacén y el usuario ya
    // existen y los conoce la sesión.
    if (this.soloConfigurar()) return true;
    return (
      this.store.almacenNombre().trim().length >= 2 &&
      this.store.usuarioNombre().trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(this.store.usuarioEmail().trim()) &&
      this.store.usuarioPassword().length >= 8
    );
  });

  protected readonly usuarioValido = computed(
    () =>
      this.store.usuarioNombre().trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(this.store.usuarioEmail().trim()) &&
      this.store.usuarioPassword().length >= 8,
  );

  /** Reglas de contraseña, para mostrarlas antes de que el usuario falle. */
  protected readonly reglasPassword = computed(() => {
    const p = this.store.usuarioPassword();
    return [
      { ok: p.length >= 8, texto: 'Al menos 8 caracteres' },
      { ok: /\d/.test(p), texto: 'Al menos un número' },
      { ok: /[a-zA-Z]/.test(p), texto: 'Al menos una letra' },
    ];
  });

  protected readonly passwordValida = computed(() => this.reglasPassword().every((r) => r.ok));

  protected puedeAvanzar(): boolean {
    switch (this.paso()) {
      case 'almacen':
        return this.pasoAlmacenValido();
      case 'pasillos':
      case 'niveles':
      case 'fuera':
        return this.store.pasillos().length > 0 && this.store.niveles().length > 0;
      default:
        return true;
    }
  }

  // ── Generación ──────────────────────────────────────────────────────

  /**
   * Se llama al entrar en el último paso: la tabla de lo que se va a crear
   * tiene que estar en pantalla antes de que exista el botón de confirmar.
   */
  protected pedirPrevisualizacion(): void {
    if (this.preview()) return;
    this.errorServidor.set(null);
    this.cargando.set(true);
    this.svc.previsualizar(this.store.toRequest()).subscribe({
      next: (p) => {
        this.preview.set(p);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorServidor.set(this.mensaje(err));
      },
    });
  }

  protected crearAlmacenYGenerar(): void {
    this.errorServidor.set(null);
    this.cargando.set(true);
    const config = this.store.toRequest();
    const datosAlmacen = this.store.toAlmacenRequest();
    const datosUsuario = this.store.toUsuarioRequest();

    // El alta va primero porque las ubicaciones necesitan un almacén al que
    // pertenecer. Si el alta falla, no se toca la base de ubicaciones.
    const crear = this.soloConfigurar()
      ? this.svc.resumen().pipe(map(() => undefined))
      : this.onboarding
          .registrar({ almacen: datosAlmacen, usuario: datosUsuario })
          .pipe(map(() => undefined));

    crear.subscribe({
      next: () => {
        this.svc.generar(config).subscribe({
          next: (r) => {
            this.cargando.set(false);
            this.creado.set({ almacen: datosAlmacen.nombre, ubicaciones: r.creadas });
            this.notify.success(
              `Listo. ${r.creadas} ubicaciones creadas en ${datosAlmacen.nombre}.`,
            );
            void this.router.navigate(['/ubicaciones']);
          },
          error: (err: unknown) => {
            this.cargando.set(false);
            this.errorServidor.set(this.mensaje(err));
          },
        });
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorServidor.set(this.mensaje(err));
      },
    });
  }

  /** Vuelve al panel sin crear nada. El alta se puede hacer luego. */
  protected volver(): void {
    void this.router.navigate(['/dashboard']);
  }

  /**
   * «Saltar» en realidad SÍ crea el almacén, solo que sin ubicaciones.
   *
   * Decirlo con esas palabras es lo honesto: si el usuario pulsa esto y no
   * existe ningún almacén, el botón sería una mentira y en el siguiente
   * intento el backend respondería que el correo ya está registrado.
   */
  protected saltar(): void {
    if (this.soloConfigurar()) {
      this.paso.set('pasillos');
      return;
    }
    if (!this.store.almacenNombre().trim() || !this.usuarioValido()) {
      this.paso.set('almacen');
      this.errorServidor.set(
        'Completa al menos el nombre del almacén, tu nombre, tu correo y una contraseña.',
      );
      return;
    }
    this.paso.set('confirmar');
    this.pedirPrevisualizacion();
  }

  protected volverAEditar(): void {
    this.paso.set('pasillos');
    this.preview.set(null);
  }

  // ── Mensajes ────────────────────────────────────────────────────────
  private mensaje(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.isNetwork) return 'No hay conexión con el servidor.';
      // El backend manda los errores de validación en `details.errores`, que
      // es más útil que el genérico.
      const errores = (err as { detalles?: { errores?: string[] } }).detalles?.errores;
      if (errores?.length) return errores.join(' ');
      return err.message;
    }
    return 'No se pudo completar. Intenta de nuevo.';
  }
}

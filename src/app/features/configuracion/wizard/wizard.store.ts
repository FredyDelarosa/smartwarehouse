import { Injectable, computed, signal } from '@angular/core';

import {
  ConfigAlmacenRequest,
  LETRAS_ESTANTE,
  MAX_ESTANTES,
  MAX_NIVELES,
  MAX_PASILLOS,
  type LetraEstante,
  type PasilloConfig,
} from '../../../core/models/configuracion.model';

/**
 * Acota un número a un rango y lo deja entero.
 *
 * `undefined` significa «el usuario ha dejado el campo vacío». NO se traduce a
 * un mínimo, se traduce a «no me lo cambies»: con `type="number"`, borrar el
 * contenido para reescribirlo dispara un `input` con valor `""`, y convertir eso
 * en 1 borraba los pasillos que el usuario ya había configurado. Se perdían
 * datos por una acción tan normal como seleccionar todo y teclear.
 */
function acotar(valor: number, min: number, max: number): number | undefined {
  const n = Math.trunc(valor);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

/** Igual que `acotar`, pero con valor por defecto si el campo va vacío. */
function acotarONo(valor: number, min: number, max: number, porDefecto: number): number {
  return acotar(valor, min, max) ?? porDefecto;
}

/**
 * Estado del cuestionario de configuración del almacén.
 *
 * ## Por qué un store y no signals sueltos en el componente
 *
 * El cuestionario son cinco pasos encadenados y la previsualización necesita
 * leer lo mismo desde un paso distinto. Con signals dentro del componente, el
 * día que se añada un paso intermedio aparece una contradicción entre la
 * verdad del formulario y la del cálculo, y no se ve en ningún sitio.
 *
 * ## Una sola fuente de verdad
 *
 * Los estantes fuera de servicio viven DENTRO de su pasillo, en
 * `PasilloConfig.estantes_fuera_servicio`. Hubo antes un `Set` aparte con la
 * clave `"2:D"` y era un error: había que mantener sincronizadas las dos
 * copias y al reducir los estantes de un pasillo el Set guardaba letras que ya
 * no existían, saliendo avisos de un hueco que nadie había creado.
 *
 * ## El estante es una letra, y no es negociable
 *
 * El código de ubicación es `P{pasillo}-{letra}-{nivel}` y el backend lo
 * valida con `CodigoUbicacion`, el mismo value object que usa para las
 * ubicaciones creadas a mano. Como el QR del almacén original ya está
 * impreso con ese formato, cambiarlo ahora obligaría a reimprimir las
 * etiquetas de los 150 estantes que ya existen. Por eso 26, no 99.
 */
@Injectable()
export class ConfiguracionWizardStore {
  // ── Paso 1: datos del almacén y del administrador ───────────────────
  readonly almacenNombre = signal('');
  readonly almacenDireccion = signal('');
  readonly usuarioNombre = signal('');
  readonly usuarioEmail = signal('');
  readonly usuarioPassword = signal('');

  // ── Paso 2: pasillos ───────────────────────────────────────────────
  readonly pasillos = signal<PasilloConfig[]>([]);
  readonly numPasillos = signal(2);

  // ── Paso 3: niveles ─────────────────────────────────────────────────
  readonly numNiveles = signal(3);

  // ── Manipulación ────────────────────────────────────────────────────

  /** Crea `n` pasillos conservando los ya configurados. */
  ajustarPasillos(n: number): void {
    const objetivo = acotarONo(n, 1, MAX_PASILLOS, this.numPasillos());
    const actuales = this.pasillos();
    const nuevos: PasilloConfig[] = Array.from({ length: objetivo }, (_, i) => {
      const previo = actuales[i];
      return previo
        ? { ...previo, estantes: acotarONo(previo.estantes, 1, MAX_ESTANTES, 4) }
        : { nombre: String(i + 1), estantes: 4, estantes_fuera_servicio: [] };
    });
    this.pasillos.set(nuevos);
    this.numPasillos.set(objetivo);
  }

  cambiarEstantes(indice: number, estantes: number): void {
    this.pasillos.update((lista) =>
      lista.map((p, i) => {
        if (i !== indice) return p;
        const n = acotar(estantes, 1, MAX_ESTANTES);
        // Campo vacío: se conserva lo que había. Ver `acotar`.
        if (n === undefined) return p;
        const validas = new Set(LETRAS_ESTANTE.slice(0, n));
        // Si se reducen, se sueltan los marcados que ya no existirían: si no,
        // quedaría un aviso de "fuera de servicio" sobre un estante fantasma.
        const fuera = p.estantes_fuera_servicio.filter((l) => validas.has(l.toUpperCase()));
        return { ...p, estantes: n, estantes_fuera_servicio: fuera };
      }),
    );
  }

  alternarFueraDeServicio(indicePasillo: number, letra: LetraEstante): void {
    const L = letra.toUpperCase();
    this.pasillos.update((lista) =>
      lista.map((p, i) => {
        if (i !== indicePasillo) return p;
        const fuera = p.estantes_fuera_servicio.includes(L)
          ? p.estantes_fuera_servicio.filter((x) => x !== L)
          : [...p.estantes_fuera_servicio, L];
        return { ...p, estantes_fuera_servicio: fuera };
      }),
    );
  }

  estaFuera(indicePasillo: number, letra: LetraEstante): boolean {
    return this.pasillos()[indicePasillo]?.estantes_fuera_servicio.includes(
      letra.toUpperCase(),
    ) ?? false;
  }

  limpiar(): void {
    this.almacenNombre.set('');
    this.almacenDireccion.set('');
    this.usuarioNombre.set('');
    this.usuarioEmail.set('');
    this.usuarioPassword.set('');
    this.numNiveles.set(3);
    this.fueraDeServicioInicial();
  }

  private fueraDeServicioInicial(): void {
    this.pasillos.set([]);
    this.numPasillos.set(2);
  }

  // ── Derivados ───────────────────────────────────────────────────────

  /** 1..n. El suelo es el 1 porque así lo espera `CodigoUbicacion`. */
  readonly niveles = computed(() =>
    Array.from(
      { length: acotarONo(this.numNiveles(), 1, MAX_NIVELES, 3) },
      (_, i) => ({ nombre: String(i + 1) }),
    ),
  );

  /** Filas que se crearán: la suma por pasillo de estantes × niveles. */
  readonly totalUbicaciones = computed(() => {
    const n = this.niveles().length;
    return this.pasillos().reduce((suma, p) => suma + p.estantes * n, 0);
  });

  readonly totalFueraDeServicio = computed(() => {
    const n = this.niveles().length;
    return this.pasillos().reduce(
      (suma, p) => suma + p.estantes_fuera_servicio.length * n,
      0,
    );
  });

  /** Filas por pasillo, para la tabla de previsualización. */
  readonly filasPorPasillo = computed(() => {
    const n = this.niveles().length;
    return this.pasillos().map((p, i) => ({
      indice: i,
      nombre: `P${p.nombre}`,
      estantes: p.estantes,
      fuera: p.estantes_fuera_servicio.length,
      total: p.estantes * n,
    }));
  });

  toRequest(): ConfigAlmacenRequest {
    return {
      pasillos: this.pasillos().map((p) => ({
        nombre: p.nombre,
        estantes: p.estantes,
        estantes_fuera_servicio: [...p.estantes_fuera_servicio],
      })),
      niveles: this.niveles(),
    };
  }

  /** El formulario de administración del almacén. */
  toAlmacenRequest(): { nombre: string; direccion: string | null } {
    return {
      nombre: this.almacenNombre().trim(),
      direccion: this.almacenDireccion().trim() || null,
    };
  }

  /** El administrador que se creará con el almacén. */
  toUsuarioRequest(): { nombre: string; email: string; password: string } {
    return {
      nombre: this.usuarioNombre().trim(),
      email: this.usuarioEmail().trim().toLowerCase(),
      password: this.usuarioPassword(),
    };
  }
}
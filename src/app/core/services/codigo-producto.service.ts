import { inject, Injectable, Service, signal } from '@angular/core';

import { ApiService } from './api.service';

/**
 * Generación de códigos de producto según la convención del catálogo.
 *
 * ## La convención
 *
 * **`prefijo de categoría` + `inicial del nombre` + `número`**
 *
 * | Categoría | Prefijo | Ejemplo            |
 * |---|---|---|
 * | Tornillería | `T` | Tornillo → `TT001`, Tuerca → `TU002` |
 * | Herramientas manuales | `HM` | Alicate → `HMA001` |
 * | Herramientas eléctricas | `HE` | Taladro → `HET001` |
 * | EPP | `G` | Guante → `GG001`, Casco → `GC001` |
 * | Insumos generales | `I` | Cinta → `IC001` |
 * | Eléctrico | `E` | Enchufe → `EE001` |
 * | Plomería | `P` | Tubería → `PT001` |
 * | Pintura | `N` | Nanotinte → `NN001` |
 *
 * ### Por qué el número NO es aleatorio
 *
 * Se busca el **siguiente libre**, no uno al azar. El servicio ya sabe qué
 * códigos existen, así que un número aleatorio no aportaría nada y además
 * obligaría a reintentar cuando saliera uno ocupado. Y un código aleatorio es
 * ilegible de viva voz: en una nave, «busca el TT014» se dice en un segundo;
 * «busca el 4713» obliga a repetirlo y a verificarlo letra a letra.
 *
 * ### La serie se lleva por categoría + inicial, no solo por categoría
 *
 * Con un contador único por categoría, Tornillería daría TT001, TU002, TA003…
 * y a la altura del producto 100 estarías buscando TT101 con un código que no
 * contiene la T. Agrupando por inicial, todos los TA* son arandelas y todos
 * los TT* son tornillos, y el código dice algo de lo que hay dentro del
 * estante.
 *
 * ## Por qué la tabla está indexada por nombre y no por id
 *
 * El `id` de categoría lo asigna la base de datos y no significa nada para
 * quien lee el catálogo: si mañana se inserta una categoría en medio, el `3`
 * deja de ser "herramientas eléctricas". El nombre es la clave estable, y el
 * prefijo es una decisión editorial, no un dato técnico.
 *
 * ## ⚠️ Las claves van SIN TILDE, a propósito
 *
 * La búsqueda normaliza el nombre de la categoría quitando tildes
 * (`Eléctrico` → `electrico`). Si estas claves las llevaran, `electrico` no
 * encontraría `eléctrico` y la categoría se quedaría sin prefijo: sin
 * sugerencia y **sin la leyenda que explica que el código se genera solo**.
 * Cuatro de las ocho categorías fallaban por eso. Si añades una categoría,
 * escribe la clave normalizada.
 */
/**
 * Categoría normalizada → prefijo y número de dígitos.
 *
 * ⚠️ Las claves van SIN TILDE. La búsqueda normaliza el nombre de la
 * categoría quitando tildes (`Eléctrico` → `electrico`); si estas claves las
 * llevaran, la categoría se quedaría sin prefijo y su producto **sin la
 * leyenda que explica que el código se genera solo**. Cuatro de las ocho
 * categorías fallaban por eso. Si añades una, escribe la clave normalizada.
 */
export const CONVENCION_PRODUCTO: Record<string, { prefijo: string; digitos: number }> = {
  tornilleria: { prefijo: 'T', digitos: 3 },
  'herramientas manuales': { prefijo: 'HM', digitos: 2 },
  'herramientas electricas': { prefijo: 'HE', digitos: 2 },
  epp: { prefijo: 'G', digitos: 3 },
  'insumos generales': { prefijo: 'I', digitos: 3 },
  electrico: { prefijo: 'E', digitos: 3 },
  plomeria: { prefijo: 'P', digitos: 3 },
  pintura: { prefijo: 'N', digitos: 3 },
};

/** Quita tildes y mayúsculas, para comparar nombres de categoría. */
export function normalizarCategoria(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Prefijo y formato de una categoría, o `null` si no hay convención. */
export function formatoCategoria(
  nombreCategoria: string | null | undefined,
): { prefijo: string; digitos: number } | null {
  if (!nombreCategoria) return null;
  return CONVENCION_PRODUCTO[normalizarCategoria(nombreCategoria)] ?? null;
}

/** Primera letra del nombre en mayúscula. `null` si no hay letra válida. */
export function inicialProducto(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const primera = nombre.trim().charAt(0).toUpperCase();
  return /^[A-ZÑ]$/.test(primera) ? primera : null;
}

/**
 * Propuesta de código: `prefijo` + `inicial del nombre` + siguiente número
 * libre de esa serie.
 *
 * Devuelve `null` —y entonces el campo se deja vacío para que lo escriba
 * quien da de alta— si la categoría no tiene prefijo, si el nombre está vacío
 * o no empieza por letra, o si la serie está llena.
 *
 * El número empieza en 1, no en `10 ** (digitos - 1)`: eso último es el valor
 * más ALTO representable, no el más bajo, y hacía que una serie de 3 dígitos
 * propusiera TT100 con T001…T010 ya usados.
 */
export function proponerCodigo(
  nombreCategoria: string | null | undefined,
  nombreProducto: string | null | undefined,
  usados: ReadonlySet<string>,
): string | null {
  const formato = formatoCategoria(nombreCategoria);
  if (!formato) return null;
  const inicial = inicialProducto(nombreProducto);
  if (!inicial) return null;

  const serie = `${formato.prefijo}${inicial}`;
  const usadosMayus = new Set([...usados].map((c) => c.toUpperCase()));

  for (let n = 1; n < 10 ** formato.digitos; n++) {
    const candidato = `${serie}${String(n).padStart(formato.digitos, '0')}`;
    if (!usadosMayus.has(candidato)) return candidato;
  }
  return null;
}


@Service()
export class CodigoProductoService {
  private readonly api = inject(ApiService);

  /** Códigos ya usados, para no proponer uno que exista. */
  private readonly _codigosUsados = signal<Set<string>>(new Set());
  private readonly _cargados = signal(false);

  /**
   * Códigos ya usados, en solo lectura, para poder reaccionar a su llegada.
   *
   * El formulario se apoya en esto: hasta que la lista no llega no se puede
   * proponer nada, y en cuanto llega hay que proponerse aunque la categoría se
   * eligiera un segundo antes.
   */
  readonly usados = this._codigosUsados.asReadonly();

  /** `true` cuando ya se intentó la carga (no cuando terminó). */
  readonly cargado = this._cargados.asReadonly();

  /**
   * Carga todos los códigos existentes una sola vez.
   *
   * Se piden también los inactivos: un producto dado de baja conserva su
   * código y la unicidad sigue aplicando, así que la serie no debe saltárselo
   * por no verlo en el listado.
   */
  cargar(): void {
    if (this._cargados()) return;
    this._cargados.set(true);

    // Páginas amplias: el objetivo es recoger identificadores, no pintar filas.
    this.api
      .get<{ codigo: string }[]>('/productos/', { skip: 0, limit: 500, activo: false })
      .subscribe({
        next: (lista) => {
          if (Array.isArray(lista)) {
            this._codigosUsados.set(new Set(lista.map((p) => p.codigo.toUpperCase())));
          }
        },
        // Sin lista no se propone nada: el usuario escribe el código a mano.
        error: () => this._codigosUsados.set(new Set()),
      });
  }

  /** Notifica de un código recién creado, para no volver a proponerlo. */
  reservar(codigo: string): void {
    const limpio = codigo.trim().toUpperCase();
    if (!limpio) return;
    this._codigosUsados.update((s) => new Set(s).add(limpio));
  }

  /** Prefijo y formato de una categoría, o `null` si no hay convención. */
  formatoDe(nombreCategoria: string | null | undefined): { prefijo: string; digitos: number } | null {
    return formatoCategoria(nombreCategoria);
  }

  /**
   * Propuesta de código para un producto, o `null`.
   *
   * `null` cuando la categoría no tiene prefijo, cuando el nombre está vacío
   * o no empieza por letra, o cuando el backend aún no ha cargado los
   * códigos. Prefiere un `null` honesto a inventar un código que rompa la
   * convención sin avisar.
   */
  siguiente(
    nombreCategoria: string | null | undefined,
    nombreProducto?: string | null,
  ): string | null {
    // Sin la lista de códigos no se puede saber si el propuesto está libre.
    if (this._codigosUsados().size === 0) return null;
    return proponerCodigo(nombreCategoria, nombreProducto, this._codigosUsados());
  }

  /** Primera letra del nombre, en mayúscula. `null` si no hay letra válida. */
  inicialDe(nombre: string | null | undefined): string | null {
    return inicialProducto(nombre);
  }

  /**
   * Texto de ayuda para la UI.
   *
   * Hay tres casos distintos y el formulario los muestra todos: con la
   * categoría elegida, sin categoría, y con una categoría que **no tiene
   * prefijo asignado**. Confundir el segundo con el tercero hacía que la UI
   * prometiese una generación automática que no iba a ocurrir.
   */
  pistaDe(
    nombreCategoria: string | null | undefined,
    nombreProducto?: string | null | undefined,
    usados?: ReadonlySet<string>,
  ): string | null {
    if (!nombreCategoria) {
      return 'Elige una categoría y escribe el nombre: el código se generará con el prefijo de la categoría y la inicial del nombre.';
    }

    const formato = formatoCategoria(nombreCategoria);
    if (!formato) {
      return `«${nombreCategoria}» no tiene prefijo asignado en la convención, así que el código no se generará solo. Escríbelo a mano.`;
    }

    const inicial = inicialProducto(nombreProducto);
    if (!inicial) {
      return `Se generará automáticamente: ${formato.prefijo} (categoría) + inicial del nombre + ${formato.digitos} dígitos. Escribe el nombre para verlo.`;
    }

    // El ejemplo es el código REAL que va a salir, no un número inventado:
    // se generó `TT000` como ejemplo, que no existe porque las series empiezan
    // en 1, y una leyenda que enseña un código imposible resta confianza a la
    // que enseña la serie entera.
    const serie = `${formato.prefijo}${inicial}`;
    const ejemplo = usados
      ? (proponerCodigo(nombreCategoria, nombreProducto, usados) ?? `${serie}${String(1).padStart(formato.digitos, '0')}`)
      : `${serie}${String(1).padStart(formato.digitos, '0')}`;

    return `Código automático: ${formato.prefijo} (categoría) + ${inicial} (inicial de tu nombre) + ${formato.digitos} dígitos → ${ejemplo}. Puedes cambiarlo.`;
  }
}

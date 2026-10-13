import { inject, Injectable, Service, signal } from '@angular/core';

import { ApiService } from './api.service';

/**
 * Generación de códigos de producto según la convención del catálogo.
 *
 * ## La convención
 *
 * Los 50 productos sembrados siguen un patrón claro: **prefijo corto por
 * categoría + número correlativo**. El prefijo describe el tipo de producto, no
 * la familia:
 *
 * | Categoría | Prefijo | Dígitos | Ejemplos          |
 * |-----------|---------|---------|-------------------|
 * | Tornillería          | `T`  | 3 | T001, T002, T010 |
 * | Herramientas manuales | `HM` | 2 | HM01, HM06 |
 * | Herramientas eléctricas | `HE` | 2 | HE01, HE05 |
 * | EPP                 | `G`  | 3 | G005, G006       |
 * | Insumos generales   | `I`  | 3 | I001, I005       |
 * | Eléctrico           | `E`  | 3 | E001, E004       |
 * | Plomería            | `P`  | 3 | P001, P005       |
 * | Pintura             | `N`  | 3 | N001, N007       |
 *
 * ## Por qué la tabla está indexada por nombre y no por id
 *
 * El `id` de categoría lo asigna la base de datos y no significa nada para
 * quien lee el catálogo: si mañana se inserta una categoría en medio, el `3`
 * deja de ser "herramientas eléctricas". El nombre es la clave estable, y el
 * prefijo es una decisión editorial, no un dato técnico.
 *
 * ## Si el backend crea una categoría nueva
 *
 * `prefijoDe()` devuelve `null` y la UI **no rellena nada**: es preferible que
 * el usuario escriba el código a mano a que se le invente uno que rompa la
 * convención sin avisar. Ver DECISIONS.md §3.12.
 */
@Service()
export class CodigoProductoService {
  private readonly api = inject(ApiService);

  /** Categoría → prefijo y número de dígitos. */
  private static readonly CONVENCION: Record<string, { prefijo: string; digitos: number }> = {
    tornillería: { prefijo: 'T', digitos: 3 },
    'herramientas manuales': { prefijo: 'HM', digitos: 2 },
    'herramientas eléctricas': { prefijo: 'HE', digitos: 2 },
    epp: { prefijo: 'G', digitos: 3 },
    'insumos generales': { prefijo: 'I', digitos: 3 },
    eléctrico: { prefijo: 'E', digitos: 3 },
    plomería: { prefijo: 'P', digitos: 3 },
    pintura: { prefijo: 'N', digitos: 3 },
  };

  /** Prefijo por defecto cuando la categoría no está en la tabla. */
  private static readonly PREFIJO_GENERICO = { prefijo: '', digitos: 3 };

  /** Códigos ya usados, para no proponer uno que exista. */
  private readonly _codigosUsados = signal<Set<string>>(new Set());
  private readonly _cargados = signal(false);

  /**
   * Carga todos los códigos existentes una sola vez.
   *
   * Se piden solo los productos activos: los dados de baja conservan su código
   * y la unicidad sigue aplicando, así que un código retirado podría
   * proponerse de nuevo. Por eso se piden también los inactivos cuando el
   * backend lo permita; si no, es una sugerencia y el servidor valida.
   */
  cargar(): void {
    if (this._cargados()) return;
    this._cargados.set(true);

    // El listado trae paginación; se piden páginas amplias porque el
    // objetivo es solo recoger identificadores, no pintar filas.
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
    if (!nombreCategoria) return null;
    const clave = this.normalizar(nombreCategoria);
    return CodigoProductoService.CONVENCION[clave] ?? null;
  }

  /**
   * Propone el siguiente código libre para una categoría.
   *
   * `Tornillería` → `T011` si ya hay T001…T010. Devuelve `null` si la
   * categoría no tiene prefijo asignado o si el backend no ha cargado los
   * códigos: entonces el campo se queda vacío para que lo escriba la persona.
   */
  siguiente(nombreCategoria: string | null | undefined): string | null {
    const formato = this.formatoDe(nombreCategoria);
    if (!formato) return null;
    if (this._codigosUsados().size === 0) return null;

    const usados = this._codigosUsados();
    const max = formato.digitos;
    const min = 10 ** (max - 1);

    let n = min;
    // Se empieza por el mínimo de la serie y se avanza hasta encontrar hueco.
    // 900 tope defensivo: evita un bucle infinito si algún día la serie
    // estuviera llena hasta el final.
    while (n < 10 ** max && n < 900) {
      const candidato = `${formato.prefijo}${String(n).padStart(max, '0')}`;
      if (!usados.has(candidato)) return candidato;
      n++;
    }
    return null;
  }

  /** Explicación para la UI: "HM + 2 dígitos → HM07". */
  pistaDe(nombreCategoria: string | null | undefined): string | null {
    const formato = this.formatoDe(nombreCategoria);
    if (!formato) return null;
    const ejemplo = `${formato.prefijo}${String(1).padStart(formato.digitos, '0')}`;
    return `Se generará automáticamente siguiendo la convención (${formato.prefijo} + ${formato.digitos} dígitos, como ${ejemplo}). Puedes cambiarlo.`;
  }

  private normalizar(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
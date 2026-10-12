import { describe, expect, it } from 'vitest';

import { normalizarPagina, paginaParams, rangoTexto } from './paginacion';

describe('paginaParams', () => {
  it('convierte página 0-based en skip', () => {
    expect(paginaParams(0, 20)).toEqual({ skip: 0, limit: 20 });
    expect(paginaParams(1, 20)).toEqual({ skip: 20, limit: 20 });
    expect(paginaParams(4, 25)).toEqual({ skip: 100, limit: 25 });
  });

  it('nunca produce un skip negativo', () => {
    expect(paginaParams(-3, 20).skip).toBe(0);
  });
});

describe('normalizarPagina — array plano (forma actual del backend)', () => {
  /** El backend devuelve arrays planos; pedimos limit+1 para deducir. */
  const recibido = (total: number, limit: number) => Array.from({ length: total }, (_, i) => i + 1);

  it('descarta el elemento extra y marca que hay página siguiente', () => {
    // Pedimos limit=3; el backend devuelve 4 porque hay más.
    const pagina = normalizarPagina(recibido(4, 3), 0, 3);

    expect(pagina.items).toEqual([1, 2, 3]);
    expect(pagina.hasNext).toBe(true);
    expect(pagina.hasPrev).toBe(false);
  });

  it('no marca página siguiente cuando llega exactamente `limit`', () => {
    const pagina = normalizarPagina(recibido(3, 3), 0, 3);

    expect(pagina.items).toEqual([1, 2, 3]);
    expect(pagina.hasNext).toBe(false);
  });

  it('marca página anterior a partir de la segunda', () => {
    const pagina = normalizarPagina(recibido(3, 3), 2, 3);

    expect(pagina.hasPrev).toBe(true);
    expect(pagina.hasNext).toBe(false);
  });

  it('tolera respuesta nula o vacía', () => {
    for (const vacio of [null, undefined, []]) {
      const pagina = normalizarPagina(vacio, 0, 20);
      expect(pagina.items).toEqual([]);
      expect(pagina.hasNext).toBe(false);
    }
  });
});

describe('normalizarPagina — forma futura {items,total}', () => {
  it('usa el total explícito sin pedir el elemento extra', () => {
    const pagina = normalizarPagina({ items: [1, 2], total: 37 }, 0, 2);

    expect(pagina.items).toEqual([1, 2]);
    // 0 * 2 < 37 → sí hay más
    expect(pagina.hasNext).toBe(true);
  });

  it('cierra la paginación en la última página', () => {
    const pagina = normalizarPagina({ items: [35, 36, 37], total: 37 }, 18, 2);

    expect(pagina.items).toEqual([35, 36, 37]);
    expect(pagina.hasNext).toBe(false);
    expect(pagina.hasPrev).toBe(true);
  });
});

describe('rangoTexto', () => {
  it('muestra el rango 1-based', () => {
    const pagina = normalizarPagina([1, 2, 3], 0, 3);
    expect(rangoTexto(pagina)).toBe('1–3');
  });

  it('indica que hay más resultados', () => {
    const pagina = normalizarPagina([1, 2, 3, 4], 0, 3);
    expect(rangoTexto(pagina)).toBe('1–3 de más…');
  });

  it('usa el total cuando se conoce', () => {
    const pagina = normalizarPagina([1, 2, 3], 0, 3);
    expect(rangoTexto(pagina, 42)).toBe('1–3 de 42');
  });

  it('responde "Sin resultados" en página vacía', () => {
    const pagina = normalizarPagina([], 0, 20);
    expect(rangoTexto(pagina)).toBe('Sin resultados');
  });
});
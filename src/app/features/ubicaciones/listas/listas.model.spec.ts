import { describe, expect, it } from 'vitest';

import type { UbicacionStock } from '../../../core/models/ubicacion.model';
import { agruparPorPasillo } from './listas.model';

/**
 * Agrupación de las listas de ubicación.
 *
 * El riesgo de este código no es que falle por exceptions: es que agrupe mal y
 * lo muestre sin que nadie se entere. Una lista que suma dos veces, o que
 * mezcla los niveles de dos estantes, sigue pareciendo una lista.
 */

function ubic(
  pasillo: string,
  estante: string,
  nivel: string,
  productos: [string, string, number][] = [],
): UbicacionStock {
  return {
    ubicacion_id: Number(`${pasillo}${estante}${nivel}`),
    codigo_ubicacion: `${pasillo}-${estante}-${nivel.padStart(2, '0')}`,
    pasillo,
    estante,
    nivel,
    productos: productos.map(([codigo, nombre, cantidad]) => ({
      // Un id estable y DISTINTO por código. La primera versión usaba solo los
      // dígitos, así que G001 y T001 acababan con el mismo id y el recuento de
      // «productos distintos» los fundía: el test fallaba por el helper, no por
      // el código, y sin ese fallo el error habría pasado por una regla mal
      // escrita.
      producto_id: [...codigo].reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7),
      codigo,
      nombre,
      cantidad,
    })),
    total_unidades: productos.reduce((s, p) => s + p[2], 0),
  };
}

describe('agruparPorPasillo', () => {
  const STOCK: UbicacionStock[] = [
    ubic('P1', 'A', '1', [['G001', 'Guantes', 180]]),
    ubic('P1', 'A', '2', [['G001', 'Guantes', 20]]),
    ubic('P1', 'B', '1', [['T001', 'Tornillos', 50]]),
    ubic('P2', 'A', '1', [['P001', 'Tubería', 7]]),
  ];

  it('agrupa por pasillo y por estante, en ese orden', () => {
    const pasillos = agruparPorPasillo(STOCK);
    expect(pasillos.map((p) => p.pasillo)).toEqual(['P1', 'P2']);
    expect(pasillos[0]!.estantes.map((e) => e.estante)).toEqual(['A', 'B']);
  });

  it('un estante agrupa sus niveles sin mezclarlos', () => {
    const estanteA = agruparPorPasillo(STOCK)[0]!.estantes[0]!;
    expect(estanteA.niveles.map((n) => n.nivel)).toEqual(['1', '2']);
    expect(estanteA.niveles[0]!.totalUnidades).toBe(180);
    expect(estanteA.niveles[1]!.totalUnidades).toBe(20);
    // El total del estante es la SUMA de los niveles, no el del primero.
    expect(estanteA.totalUnidades).toBe(200);
  });

  it('el mismo producto en dos niveles aparece en los dos, no duplicado en uno', () => {
    const estanteA = agruparPorPasillo(STOCK)[0]!.estantes[0]!;
    const enNivel1 = estanteA.niveles[0]!.productos.filter((p) => p.codigo === 'G001');
    const enNivel2 = estanteA.niveles[1]!.productos.filter((p) => p.codigo === 'G001');
    expect(enNivel1).toHaveLength(1);
    expect(enNivel2).toHaveLength(1);
    expect(enNivel1[0]!.cantidad).toBe(180);
    expect(enNivel2[0]!.cantidad).toBe(20);
  });

  it('el total del pasillo suma estantes y el de productos cuenta distintos', () => {
    const p1 = agruparPorPasillo(STOCK)[0]!;
    expect(p1.totalUnidades).toBe(200 + 50);
    // G001 aparece en dos niveles pero es un solo producto.
    expect(p1.totalProductos).toBe(2);
  });

  it('los códigos del estante son los de cada nivel, para el título', () => {
    const estanteA = agruparPorPasillo(STOCK)[0]!.estantes[0]!;
    expect(estanteA.codigos).toEqual(['P1-A-01', 'P1-A-02']);
  });

  it('ordena los pasillos por número, no por texto', () => {
    // Ordenar por texto daría P1, P10, P2, que es como se recorre un almacén
    // de más de nueve pasillos y no como está en la nave.
    const muchos = [
      ubic('P10', 'A', '1', [['X1', 'x', 1]]),
      ubic('P2', 'A', '1', [['X2', 'x', 1]]),
      ubic('P1', 'A', '1', [['X3', 'x', 1]]),
    ];
    expect(agruparPorPasillo(muchos).map((p) => p.pasillo)).toEqual(['P1', 'P2', 'P10']);
  });

  it('ordena los niveles por número, no por texto', () => {
    const stock = [
      ubic('P1', 'A', '10', [['X1', 'x', 1]]),
      ubic('P1', 'A', '2', [['X2', 'x', 1]]),
      ubic('P1', 'A', '1', [['X3', 'x', 1]]),
    ];
    const niveles = agruparPorPasillo(stock)[0]!.estantes[0]!.niveles;
    expect(niveles.map((n) => n.nivel)).toEqual(['1', '2', '10']);
  });

  it('una ubicación sin productos no inventa filas', () => {
    const pasillos = agruparPorPasillo([ubic('P1', 'A', '1')]);
    expect(pasillos[0]!.estantes[0]!.niveles[0]!.productos).toEqual([]);
    expect(pasillos[0]!.totalUnidades).toBe(0);
  });

  it('devuelve una lista vacía si no hay nada', () => {
    expect(agruparPorPasillo([])).toEqual([]);
  });

  it('dentro de un nivel ordena por código de producto', () => {
    const stock = [ubic('P1', 'A', '1', [['Z009', 'Zeta', 1], ['A001', 'Alfa', 1]])];
    const productos = agruparPorPasillo(stock)[0]!.estantes[0]!.niveles[0]!.productos;
    expect(productos.map((p) => p.codigo)).toEqual(['A001', 'Z009']);
  });
});
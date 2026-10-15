import { describe, expect, it } from 'vitest';

import {
  CONVENCION_PRODUCTO,
  formatoCategoria,
  inicialProducto,
  normalizarCategoria,
  proponerCodigo,
} from './codigo-producto.service';

/**
 * La convención de códigos de producto.
 *
 * El primer caso de este fichero es una regresión real: la tabla de
 * prefijos guardaba los nombres CON tilde (`tornillería`, `eléctrico`) mientras
 * que la búsqueda los normalizaba SIN ella. Cuatro de las ocho categorías no
 * sechwacían a encontrar su prefijo, así que sus productos se quedaban sin
 * código sugerido y sin la leyenda que lo explica. Nadie se dio cuenta
 * probando a mano, porque las otras cuatro sí funcionaban.
 */

/** Las ocho categorías reales del catálogo sembrado. */
const CATEGORIAS_CATALOGO = [
  'Tornillería',
  'Herramientas manuales',
  'Herramientas eléctricas',
  'EPP',
  'Insumos generales',
  'Eléctrico',
  'Plomería',
  'Pintura',
];

describe('formatoCategoria', () => {
  it('encuentra el prefijo de las ocho categorías del catálogo', () => {
    const sinPrefijo = CATEGORIAS_CATALOGO.filter((c) => formatoCategoria(c) === null);
    expect(sinPrefijo).toEqual([]);
  });

  it('funciona con y sin tilde, y con mayúsculas y espacios de más', () => {
    for (const base of ['Eléctrico', 'Plomería', 'Tornillería', 'Herramientas eléctricas']) {
      const conTilde = formatoCategoria(base)?.prefijo;
      const sinTilde = formatoCategoria(normalizarCategoria(base))?.prefijo;
      expect(conTilde).toBeTruthy();
      expect(sinTilde).toBe(conTilde);
    }
    expect(formatoCategoria('  tornillería  ')?.prefijo).toBe('T');
    expect(formatoCategoria('TORNILLERÍA')?.prefijo).toBe('T');
  });

  it('devuelve null si la categoría no tiene convención asignada', () => {
    expect(formatoCategoria('Ferretería')).toBeNull();
    expect(formatoCategoria('')).toBeNull();
    expect(formatoCategoria(null)).toBeNull();
    expect(formatoCategoria(undefined)).toBeNull();
  });

  it('las claves de la tabla están normalizadas', () => {
    // Si alguien añade una clave con tilde, esta comprobación lo delata.
    for (const clave of Object.keys(CONVENCION_PRODUCTO)) {
      expect(clave).toBe(normalizarCategoria(clave));
    }
  });
});

describe('inicialProducto', () => {
  it('toma la primera letra en mayúscula', () => {
    expect(inicialProducto('arandela plana')).toBe('A');
    expect(inicialProducto('  tornillo')).toBe('T');
    expect(inicialProducto('Ñácar')).toBe('Ñ');
  });

  it('devuelve null si no empieza por letra', () => {
    expect(inicialProducto('3 tornillos')).toBeNull();
    expect(inicialProducto('  ')).toBeNull();
    expect(inicialProducto('')).toBeNull();
    expect(inicialProducto(null)).toBeNull();
  });
});

describe('proponerCodigo', () => {
  const usados = new Set(['T001', 'T002', 'T010', 'HM01', 'HM06', 'E001', 'P001', 'N007']);

  it('arma prefijo de categoría + inicial del nombre + número', () => {
    expect(propone('Tornillería', 'Tornillo de acero')).toBe('TT001');
    expect(propone('Plomería', 'Tubería PVC')).toBe('PT001');
    expect(propone('Herramientas manuales', 'Alicate')).toBe('HMA01');
    expect(propone('EPP', 'Guantes')).toBe('GG001');
  });

  it('agrupa la serie por inicial, no solo por categoría', () => {
    // Dos productos que empiezan por A comparten serie, uno que empieza por
    // T tiene la suya propia. Así todos los TA* son arandelas y todos los TT*
    // son tornillos, y el código dice algo de lo que hay en el estante.
    //
    // `proponerCodigo` es pura: no recuerda lo que propuso antes. Es el
    // servicio quien va guardando cada código en su conjunto, así que aquí se
    // replica lo mismo a mano.
    const vistos = new Set<string>();
    const siguiente = (nombre: string): string | null => {
      const c = proponerCodigo('Tornillería', nombre, vistos);
      if (c) vistos.add(c);
      return c;
    };

    expect(siguiente('Arandela')).toBe('TA001');
    expect(siguiente('Abrazadera')).toBe('TA002');
    expect(siguiente('Tornillo')).toBe('TT001');
    expect(siguiente('Tuerca')).toBe('TT002');
  });

  it('el número empieza en 001, no en 100', () => {
    // Regresión: `10 ** (digitos - 1)` es el valor más alto de la serie, no el
    // más bajo, y hacía que con T001, T002 y T010 usados se propusiera TT100.
    expect(propone('Tornillería', 'Tornillo')).toBe('TT001');
  });

  it('salta los números ya usados', () => {
    expect(propone('Tornillería', 'Tornillo', new Set(['TT001', 'TT002']))).toBe('TT003');
    expect(propone('Eléctrico', 'Enchufe', new Set(['EE001']))).toBe('EE002');
  });

  it('no le importan las mayúsculas de los códigos usados', () => {
    expect(propone('Tornillería', 'Tornillo', new Set(['tt001']))).toBe('TT002');
  });

  it('no propone nada si falta el nombre o no empieza por letra', () => {
    expect(propone('Tornillería', '')).toBeNull();
    expect(propone('Tornillería', '   ')).toBeNull();
    expect(propone('Tornillería', '3M cinta')).toBeNull();
  });

  it('no propone nada si la categoría no tiene prefijo', () => {
    expect(propone('Ferretería', 'Martillo')).toBeNull();
  });

  it('devuelve null si la serie está llena', () => {
    const llena = new Set<string>();
    for (let n = 1; n < 1000; n++) llena.add(`TT${String(n).padStart(3, '0')}`);
    expect(propone('Tornillería', 'Tornillo', llena)).toBeNull();
  });

  function propone(cat: string, nombre: string, set: ReadonlySet<string> = usados) {
    return proponerCodigo(cat, nombre, set);
  }
});
import { describe, expect, it } from 'vitest';

import {
  capitalize,
  formatCantidad,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  pluralize,
  toIsoDate,
} from './format';

describe('formatNumber', () => {
  it('usa separador de miles es-CO', () => {
    expect(formatNumber(1250)).toBe('1.250');
    expect(formatNumber(999)).toBe('999');
  });

  it('devuelve guion largo para valores ausentes', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('muestra segundos por debajo del minuto', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(59)).toBe('59 s');
  });

  it('muestra minutos exactos sin decimales', () => {
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(120)).toBe('2 min');
  });

  it('descompone minutos y segundos', () => {
    expect(formatDuration(82)).toBe('1 m 22 s');
    expect(formatDuration(517)).toBe('8 m 37 s');
  });

  it('redondea valores fraccionarios', () => {
    expect(formatDuration(82.5)).toBe('1 m 23 s');
  });

  it('tolera valores ausentes', () => {
    expect(formatDuration(null)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('añade el símbolo de porcentaje y usa coma decimal (es-CO)', () => {
    expect(formatPercent(84.02)).toBe('84 %');
    expect(formatPercent(84.02, 2)).toBe('84,02 %');
  });

  it('no rellena con ceros decimales innecesarios', () => {
    expect(formatPercent(84)).toBe('84 %');
    expect(formatPercent(0)).toBe('0 %');
  });
});

describe('formatCantidad', () => {
  it('concatena cantidad y unidad', () => {
    expect(formatCantidad(350, 'pieza')).toBe('350 piezas');
  });

  it('usa singular para 1', () => {
    expect(formatCantidad(1, 'par')).toBe('1 par');
  });

  it('mantiene plurales irregulares', () => {
    // "par" → "pares" (no "pars")
    expect(formatCantidad(4, 'par')).toBe('4 pares');
  });
});

describe('pluralize', () => {
  it('usa el singular para 1 y el plural por defecto para el resto', () => {
    expect(pluralize(1, 'pieza')).toBe('pieza');
    expect(pluralize(3, 'pieza')).toBe('piezas');
  });

  it('acepta un plural explícito', () => {
    expect(pluralize(0, 'caja', 'cajas')).toBe('cajas');
  });
});

describe('parseo de fechas del backend', () => {
  it('entiende el formato SQL datetime sin zona', () => {
    // El backend devuelve "2024-01-15 10:30:00"; debe interpretarse como hora local.
    expect(formatRelative('2024-01-15 10:30:00')).not.toBe('—');
  });

  it('devuelve guion largo para fechas inválidas', () => {
    expect(formatRelative(null)).toBe('—');
    expect(formatRelative('no-es-una-fecha')).toBe('—');
  });
});

describe('formatRelative', () => {
  it('usa "hace un momento" para lo recién hecho', () => {
    expect(formatRelative(new Date())).toBe('hace un momento');
  });

  it('usa minutos, horas y días', () => {
    const hace = (ms: number) => formatRelative(new Date(Date.now() - ms));

    expect(hace(5 * 60_000)).toBe('hace 5 min');
    expect(hace(3 * 3_600_000)).toBe('hace 3 h');
    expect(hace(2 * 86_400_000)).toBe('hace 2 d');
  });
});

describe('capitalize', () => {
  it('pone en mayúscula la primera letra', () => {
    expect(capitalize('mal_ubicado')).toBe('Mal_ubicado');
    expect(capitalize('MAL_UBICADO')).toBe('Mal_ubicado');
  });
});

describe('toIsoDate', () => {
  it('devuelve YYYY-MM-DD con ceros a la izquierda', () => {
    expect(toIsoDate(new Date(2024, 0, 5))).toBe('2024-01-05');
    expect(toIsoDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });
});
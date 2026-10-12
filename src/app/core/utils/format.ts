/**
 * Utilidades de formato (es-CO).
 *
 * `Intl` está en todos los navegadores modernos; no añadimos date-fns ni
 * moment para formatear 6 cosas.
 */

const NUM = new Intl.NumberFormat('es-CO');
const NUM1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : NUM.format(value);
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  // `maximumFractionDigits` sin `minimumFractionDigits`: 84.02 → "84" y no
  // "84,0". Mostrar ceros decimales de relleno infla visualmente los KPI.
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: digits })} %`;
}

/**
 * Duración legible para el worker: "45 s" o "1 m 22 s".
 * El objetivo del proyecto es que el número se lea de un vistazo, sin
 * interpretar decimales.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} min` : `${m} m ${rest} s`;
}

/**
 * Convierte una fecha del backend ("2024-01-15 10:30:00", sin zona) a Date.
 * El backend devuelve SQL datetime: lo tratamos como hora local.
 */
export function parseBackendDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseBackendDate(value);
  return d ? FECHA.format(d) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseBackendDate(value);
  return d ? FECHA_HORA.format(d) : '—';
}

/** "hace 3 h" — para listados donde la fecha exacta importa menos. */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseBackendDate(value);
  if (!d) return '—';

  const diffSeg = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSeg < 60) return 'hace un momento';
  if (diffSeg < 3600) return `hace ${Math.floor(diffSeg / 60)} min`;
  if (diffSeg < 86_400) return `hace ${Math.floor(diffSeg / 3600)} h`;
  if (diffSeg < 604_800) return `hace ${Math.floor(diffSeg / 86_400)} d`;
  return FECHA.format(d);
}

/**
 * Pluraliza una unidad de medida en español.
 *
 * Por defecto basta añadir "s", pero hay palabras que no lo siguen:
 *   - "par" → "pares" (no "pars")
 *   - "medidor"/"juego" ya acaban en vocal pero sí pluralizan
 *   - los que acaban en -z cambian: "vez" → "veces", "luz" → "luces"
 *
 * Sin este diccionario, un almacén con 4 pares mostraría "4 pars".
 */
const PLURALES_IRREGULARES: Readonly<Record<string, string>> = {
  par: 'pares',
  papel: 'papeles',
  vez: 'veces',
  luz: 'luces',
  reloj: 'relojes',
  smell: 'smells',
};

/** Palabras que ya son plural y no deben recibir otra "s". */
const YA_PLURAL: ReadonlySet<string> = new Set([
  'caja',
  'pulgadas',
  'unidades',
  'metros',
  'litros',
  'rollos',
  'paquetes',
]);

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  if (plural) return plural;
  if (YA_PLURAL.has(singular)) return singular;

  const irregular = PLURALES_IRREGULARES[singular.toLowerCase()];
  if (irregular) return irregular;

  if (singular.endsWith('z')) return singular.slice(0, -1) + 'ces';
  return singular + 's';
}

/** `cantidad + unidad`: "350 piezas". */
export function formatCantidad(value: number | null | undefined, unidad: string | null): string {
  if (value === null || value === undefined) return '—';
  const u = unidad ?? 'unidad';
  return `${NUM.format(value)} ${value === 1 ? u : pluralize(value, u)}`;
}

/** Capitaliza la primera letra (tipos de incidencia, roles). */
export function capitalize(value: string | null | undefined): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Fecha a formato `YYYY-MM-DD` para query params. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
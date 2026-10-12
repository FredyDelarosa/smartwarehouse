import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import type {
  Comparativa,
  ResumenIncidencias,
  ResumenMovimientos,
  TiempoPromedio,
} from '../../core/models/metrica.model';
import { AuthStore } from '../../core/store/auth.store';
import {
  formatDecimal,
  formatDuration,
  formatNumber,
  formatPercent,
  toIsoDate,
} from '../../core/utils/format';
import { BadgeComponent } from '../../shared/components/badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { IconComponent } from '../../shared/components/icon.component';
import {
  BarChartComponent,
  BarListComponent,
  DonutChartComponent,
  MejoraBadgeComponent,
  type FilaBarra,
  type SegmentoDonut,
  type SerieBarra,
} from '../../shared/components/charts';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { MetricasService } from './metricas.service';

/** Los 4 parámetros de fecha que exige `GET /metricas/comparativa`. */
type ParametrosComparativa = {
  desdeAnterior: string;
  hastaAnterior: string;
  desdeActual: string;
  hastaActual: string;
};

type Preset = {
  id: string;
  label: string;
  params: () => ParametrosComparativa;
  descripcion: () => string;
};

/**
 * Atajos de periodo.
 *
 * Todos se calculan **relativos a hoy**, nunca con un año fijo: el almacén
 * acumula búsquedas todos los años y un preset anclado a 2026 se quedaría
 * vacío en 2027. Para comparar periodos arbitrarios (p. ej. dos meses de 2025)
 * los campos de fecha son editables.
 */
const PRESETS: Preset[] = [
  {
    id: 'mes-anterior',
    label: 'Mes anterior',
    descripcion: () => 'El mes que acaba de cerrar contra el que lo precede.',
    params: () => {
      const hoy = new Date();
      const finAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 0);
      const iniAnterior = new Date(finAnterior.getFullYear(), finAnterior.getMonth(), 1);
      const finActual = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      const iniActual = new Date(finActual.getFullYear(), finActual.getMonth(), 1);
      return {
        desdeAnterior: toIsoDate(iniAnterior),
        hastaAnterior: toIsoDate(finAnterior),
        desdeActual: toIsoDate(iniActual),
        hastaActual: toIsoDate(finActual),
      };
    },
  },
  {
    id: '30-dias',
    label: 'Últimos 30 días',
    descripcion: () => 'Los últimos 30 días contra los 30 anteriores.',
    params: () => {
      const fin = new Date();
      const inicioActual = new Date(fin);
      inicioActual.setDate(inicioActual.getDate() - 30);
      const finAnterior = new Date(inicioActual);
      const inicioAnterior = new Date(finAnterior);
      inicioAnterior.setDate(inicioAnterior.getDate() - 30);
      return {
        desdeAnterior: toIsoDate(inicioAnterior),
        hastaAnterior: toIsoDate(finAnterior),
        desdeActual: toIsoDate(inicioActual),
        hastaActual: toIsoDate(fin),
      };
    },
  },
  {
    id: 'trimestre',
    label: 'Trimestre',
    descripcion: () => 'Los últimos 3 meses contra los 3 anteriores.',
    params: () => {
      const fin = new Date();
      const inicioActual = new Date(fin);
      inicioActual.setMonth(inicioActual.getMonth() - 3);
      const finAnterior = new Date(inicioActual);
      const inicioAnterior = new Date(finAnterior);
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 3);
      return {
        desdeAnterior: toIsoDate(inicioAnterior),
        hastaAnterior: toIsoDate(finAnterior),
        desdeActual: toIsoDate(inicioActual),
        hastaActual: toIsoDate(fin),
      };
    },
  },
];

/** "MAL_UBICADO" → "Mal ubicado". Los enums del backend son SCREAMING_SNAKE. */
function humanizar(clave: string): string {
  const [primera = '', ...resto] = clave.toLowerCase().split('_');
  return [primera.charAt(0).toUpperCase() + primera.slice(1), ...resto].join(' ');
}

/**
 * Métricas de gestión — el argumento central del proyecto:
 * "antes 8 min para encontrar un producto, después 1.5 min".
 *
 * `rxResource` (Resource API de v22) es reactivo: al cambiar cualquier
 * parámetro vuelve a pedir los datos solo, sin `switchMap` manual ni
 * suscripciones que limpiar. OJO: `rxResource` devuelve un objeto `ResourceRef`,
 * no un signal invocable como `httpResource`.
 */
@Component({
  selector: 'sw-metricas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metricas.component.html',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
    BarChartComponent,
    BarListComponent,
    DonutChartComponent,
    MejoraBadgeComponent,
  ],
})
export class MetricasComponent {
  private readonly metricas = inject(MetricasService);
  private readonly store = inject(AuthStore);

  /** Solo Administrador y Supervisor; el guard de ruta ya filtra. */
  readonly puedeVer = computed(() => this.store.can('metricas:ver'));

  protected readonly presets = PRESETS;

  /**
   * Fechas editables. Se inicializan con el primer preset y el usuario puede
   * ajustarlas a cualquier periodo: los atajos son ayudas, no una jaula.
   */
  private readonly fechas = signal<ParametrosComparativa>(PRESETS[0]!.params());

  protected readonly presetActivo = signal<string | null>(PRESETS[0]!.id);

  /** Parámetros que consume el recurso (reactivo). */
  private parametros(): ParametrosComparativa {
    return this.fechas();
  }

  // ── Recursos ──────────────────────────────────────────────────────────

  // OJO: en `rxResource` la función es `stream` (en `resource()` es `loader`)
  // y `params` (no `request`). Exige los DOS parámetros de tipo.
  protected readonly comparativa = rxResource<Comparativa, string>({
    params: () => this.parametros().desdeActual,
    stream: () =>
      this.metricas.comparativa(this.parametros()).pipe(
        // Un fallo aquí no debe tumbar la pantalla: el resto de tarjetas
        // sigue funcionando y esta sección muestra su propio aviso.
        catchError((err: unknown) => {
          this.registrarError(err);
          return of(null as unknown as Comparativa);
        }),
      ),
    defaultValue: null as unknown as Comparativa,
  });

  protected readonly incidencias = rxResource<ResumenIncidencias, string>({
    params: () => 'incidencias',
    stream: () =>
      this.metricas
        .incidencias()
        .pipe(catchError(() => of(null as unknown as ResumenIncidencias))),
    defaultValue: null as unknown as ResumenIncidencias,
  });

  protected readonly movimientos = rxResource<ResumenMovimientos, string>({
    params: () => 'movimientos',
    stream: () =>
      this.metricas
        .movimientos()
        .pipe(catchError(() => of(null as unknown as ResumenMovimientos))),
    defaultValue: null as unknown as ResumenMovimientos,
  });

  protected readonly tiempo = rxResource<TiempoPromedio, string>({
    params: () => 'tiempo',
    stream: () =>
      this.metricas
        .tiempoPromedio()
        .pipe(catchError(() => of(null as unknown as TiempoPromedio))),
    defaultValue: null as unknown as TiempoPromedio,
  });

  // ── Vistas derivadas ──────────────────────────────────────────────────

  protected readonly barrasComparativa = computed<SerieBarra[]>(() => {
    const c = this.comparativa.value();
    if (!c) return [];
    return [
      {
        etiqueta: 'Antes',
        valor: c.periodo_anterior.promedio_segundos ?? 0,
        color: 'var(--color-border-strong)',
      },
      {
        etiqueta: 'Después',
        valor: c.periodo_actual.promedio_segundos ?? 0,
        color: 'var(--color-accent)',
      },
    ];
  });

  /**
   * La mejora solo es representativa si **ambos** periodos tienen búsquedas.
   * Comparar contra un periodo vacío daría un porcentaje engañoso (y el
   * backend lo manda en `null` justamente por eso).
   */
  protected readonly mejoraVisible = computed(() => {
    const c = this.comparativa.value();
    return (
      !!c &&
      c.periodo_anterior.total_busquedas > 0 &&
      c.periodo_actual.total_busquedas > 0 &&
      (c.mejora_porcentaje ?? 0) > 0
    );
  });

  protected readonly etiquetaMejora = computed(() => {
    const c = this.comparativa.value();
    return c?.mejora_porcentaje != null ? formatPercent(c.mejora_porcentaje) : '';
  });

  /** periods with no searches → show an explicit explanation instead of "—". */
  protected readonly sinDatos = computed(() => {
    const c = this.comparativa.value();
    if (!c) return null;
    const antes = c.periodo_anterior.total_busquedas;
    const despues = c.periodo_actual.total_busquedas;
    if (antes === 0 && despues === 0) return 'Ninguno de los dos periodos tiene búsquedas registradas.';
    if (antes === 0) return 'El periodo "antes" no tiene búsquedas registradas.';
    if (despues === 0) return 'El periodo "después" no tiene búsquedas registradas.';
    return null;
  });

  protected readonly distribucionIncidencias = computed<SegmentoDonut[]>(() => {
    const r = this.incidencias.value();
    if (!r) return [];
    const colores: Record<string, string> = {
      MAL_UBICADO: 'var(--color-warning)',
      FALTANTE: 'var(--color-danger)',
      DANADO: 'var(--color-info)',
      OTRO: 'var(--color-muted-foreground)',
    };
    return Object.entries(r.por_tipo).map(([tipo, valor]) => ({
      etiqueta: humanizar(tipo),
      valor: valor ?? 0,
      color: colores[tipo] ?? 'var(--color-muted-foreground)',
    }));
  });

  protected readonly barrasMovimientos = computed<FilaBarra[]>(() => {
    const r = this.movimientos.value();
    if (!r) return [];
    return Object.entries(r.por_tipo).map(([tipo, valor]) => ({
      etiqueta: humanizar(tipo),
      valor: valor ?? 0,
    }));
  });

  protected readonly fmt = { formatNumber, formatDecimal, formatDuration, formatPercent };

  // ── Interacción ───────────────────────────────────────────────────────

  protected aplicarPreset(id: string): void {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.fechas.set(preset.params());
    this.presetActivo.set(id);
  }

  /** Al tocar una fecha a mano, el preset deja de ser "el periodo actual". */
  protected onFecha(campo: keyof ParametrosComparativa, event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.fechas.update((f) => ({ ...f, [campo]: valor }));
    this.presetActivo.set(null);
  }

  protected readonly fechasActuales = computed(() => this.fechas());

  protected readonly activoCls =
    'rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors';
  protected readonly inactivoCls =
    'rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-sunken';

  protected descripcionPreset(): string {
    const id = this.presetActivo();
    const preset = PRESETS.find((p) => p.id === id);
    return preset ? preset.descripcion() : 'Periodos personalizados.';
  }

  /** Evita inundar al usuario con un toast por cada reintento de la resource. */
  private erroresNotificados = new Set<string>();
  private registrarError(err: unknown): void {
    const clave = err instanceof Error ? err.message : String(err);
    if (this.erroresNotificados.has(clave)) return;
    this.erroresNotificados.add(clave);
    console.warn('[métricas]', err);
  }
}
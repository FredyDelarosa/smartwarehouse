/**
 * Métricas e indicadores.
 * Espejo de: /metricas/dashboard, /metricas/tiempo-promedio,
 *             /metricas/comparativa, /metricas/incidencias, /metricas/movimientos
 */

/** GET /metricas/dashboard — los 6 KPIs principales del proyecto. */
export type DashboardResumen = {
  total_productos: number;
  total_ubicaciones: number;
  productos_stock_bajo: number;
  total_incidencias_abiertas: number;
  tiempo_promedio_busqueda_segundos: number;
  tiempo_promedio_busqueda_minutos: number;
  total_busquedas: number;
};

/**
 * GET /metricas/tiempo-promedio
 *
 * OJO con los nulls: cuando un rango no tiene búsquedas, el backend devuelve
 * `promedio_segundos: null` (no 0). Dividir por ello daría NaN en la UI.
 */
export type TiempoPromedio = {
  desde: string | null;
  hasta: string | null;
  total_busquedas: number;
  promedio_segundos: number | null;
  promedio_minutos: number | null;
  exitosas: number;
  fallidas: number;
};

/** Lado de la comparativa "antes vs después". */
export type LadoComparativa = {
  desde?: string | null;
  hasta?: string | null;
  total_busquedas: number;
  promedio_segundos: number | null;
};

/**
 * GET /metricas/comparativa — los 4 params de fecha son obligatorios.
 *
 * `mejora_*` llegan en `null` cuando algún periodo no tiene búsquedas:
 * no se puede calcular una reducción sobre cero datos.
 */
export type Comparativa = {
  periodo_actual: LadoComparativa;
  periodo_anterior: LadoComparativa;
  /** Diferencia en segundos (anterior - actual). Negativo = empeoró. */
  mejora_segundos: number | null;
  mejora_porcentaje: number | null;
};

/** GET /metricas/incidencias */
export type ResumenIncidencias = {
  total: number;
  abiertas: number;
  resueltas: number;
  por_tipo: Partial<Record<string, number>>;
};

/** GET /metricas/movimientos */
export type ResumenMovimientos = {
  total: number;
  por_tipo: Partial<Record<string, number>>;
  total_piezas_movidas: number;
};
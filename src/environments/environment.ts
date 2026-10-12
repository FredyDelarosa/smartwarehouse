/**
 * Entorno de DESARROLLO.
 *
 * `apiUrl` es relativa a propósito: el dev-server hace de proxy hacia
 * http://localhost:8000 (ver proxy.conf.json) y así evitamos CORS.
 */
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  appName: 'SmartWarehouse',
  /**
   * Backend simulado para trabajar sin el servidor.
   *
   * `false` por defecto: el backend real está disponible en localhost:8000 y
   * la app debe hablar con él. Ponlo en `true` solo si necesitas desarrollar
   * sin levantar el servidor (demos offline, CI, capturas de pantalla).
   *
   * En producción es SIEMPRE `false` (ver environment.prod.ts).
   */
  useMockApi: false,
  /** Latencia artificial del mock (ms). 0 = inmediata. */
  mockLatencyMs: 220,
};
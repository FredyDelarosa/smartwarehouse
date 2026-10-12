/**
 * Entorno de PRODUCCIÓN.
 *
 * En producción el mock está SIEMPRE desactivado: si el backend no responde,
 * la UI debe mostrar el error real, no datos inventados.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  appName: 'SmartWarehouse',
  useMockApi: false,
  mockLatencyMs: 0,
};
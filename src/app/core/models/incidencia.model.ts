/** Incidencias. Espejo de: /incidencias, /incidencias/{id}/resolver */

export type IncidenciaTipo = 'MAL_UBICADO' | 'FALTANTE' | 'DANADO' | 'OTRO';

export const INCIDENCIA_TIPOS: readonly IncidenciaTipo[] = [
  'MAL_UBICADO',
  'FALTANTE',
  'DANADO',
  'OTRO',
] as const;

export type Incidencia = {
  id: number;
  tipo: IncidenciaTipo;
  producto_id: number | null;
  ubicacion_id: number | null;
  usuario_id: number;
  fecha: string;
  descripcion: string | null;
  resuelta: boolean;
  fecha_resolucion: string | null;
};

export type IncidenciaCreate = {
  tipo: IncidenciaTipo;
  producto_id?: number | null;
  ubicacion_id?: number | null;
  descripcion?: string | null;
};

export type IncidenciaQuery = {
  tipo?: IncidenciaTipo | null;
  resuelta?: boolean | null;
  producto_id?: number | null;
  /** ISO 8601. */
  desde?: string | null;
  /** ISO 8601. */
  hasta?: string | null;
  skip?: number;
  limit?: number;
};
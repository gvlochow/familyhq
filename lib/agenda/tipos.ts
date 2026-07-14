/**
 * Dominio de la agenda familiar: tareas y eventos puntuales. PURO: sin Next.js ni
 * Supabase. database.types tipa las columnas como string; este módulo es la fuente
 * de verdad del dominio (CLAUDE.md: enums tipados, no strings sueltos).
 */

import type { Recurrencia } from './recurrencia'

/** 'tarea' se completa; 'evento' ocurre a una hora. */
export type TipoAgenda = 'tarea' | 'evento'

export const TIPOS_AGENDA: readonly TipoAgenda[] = ['tarea', 'evento']

export function esTipoAgenda(v: string): v is TipoAgenda {
  return (TIPOS_AGENDA as readonly string[]).includes(v)
}

/** Referencia liviana a un integrante (para asignados y "agregado por"). */
export interface MiembroRef {
  id: string
  inicial: string
  nombre: string
}

/** Un item de agenda tal como lo consume la UI (subconjunto de agenda_items). */
export interface AgendaItem {
  id: string
  tipo: TipoAgenda
  titulo: string
  /** yyyy-mm-dd (fecha local). */
  fecha: string
  /** "HH:MM" o null (todo el día / sin hora). */
  hora: string | null
  completado: boolean
  /** Integrantes asignados, ya resueltos a nombre/inicial. */
  asignados: MiembroRef[]
  /** Nombre de quién lo agregó (registro visual). */
  agregadoPor: string | null
  /**
   * Marcadores de recurrencia. Una ocurrencia EXPANDIDA de una regla recurrente los
   * lleva; un item puntual (fila de agenda_items) no. La UI y las acciones ramifican
   * por `recurrente` (completar/eliminar tocan recurring_completions / la regla, no
   * agenda_items).
   */
  recurrente?: boolean
  /** id de la regla (recurring_activities) — solo si recurrente. */
  recurrenteId?: string
  /** Resumen legible de la recurrencia ("cada 5 del mes") — solo si recurrente. */
  recurrenciaResumen?: string
  /** Regla cruda de recurrencia — solo si recurrente (para prellenar la edición). */
  recurrencia?: Recurrencia
  /** fecha_fin de la regla (yyyy-mm-dd o null) — solo si recurrente. */
  recurrenteFechaFin?: string | null
}

/** Fila cruda de agenda_items (subconjunto que leen las pantallas). */
export interface FilaAgendaDB {
  id: string
  tipo: string
  titulo: string
  fecha: string
  hora: string | null
  completado: boolean
  asignado_a: string[] | null
  created_by: string | null
}

/**
 * Mapea una fila de agenda_items a la vista, resolviendo asignados y el creador
 * contra el mapa de integrantes del hogar. Devuelve null si el tipo no es válido
 * (drift de datos). Ids que ya no resuelvan a un integrante se descartan.
 */
export function mapearAgendaItem(
  r: FilaAgendaDB,
  miembros: Map<string, MiembroRef>,
): AgendaItem | null {
  if (!esTipoAgenda(r.tipo)) return null
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    fecha: r.fecha,
    hora: r.hora ? r.hora.slice(0, 5) : null, // "HH:MM:SS" -> "HH:MM"
    completado: r.completado,
    asignados: (r.asignado_a ?? [])
      .map((id) => miembros.get(id))
      .filter((m): m is MiembroRef => m !== undefined),
    agregadoPor: r.created_by ? (miembros.get(r.created_by)?.nombre ?? null) : null,
  }
}

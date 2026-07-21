/**
 * Dominio de la agenda familiar: tareas y eventos puntuales. PURO: sin Next.js ni
 * Supabase. database.types tipa las columnas como string; este módulo es la fuente
 * de verdad del dominio (CLAUDE.md: enums tipados, no strings sueltos).
 */

import type { Recurrencia } from './recurrencia'
import type { CategoriaRef } from './categorias'

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
  /** "HH:MM" o null. Hora de término (solo eventos con hora); null si no aplica. */
  horaFin: string | null
  /** true si el evento marca 'fuera' a sus asignados durante su ventana. */
  afectaDisponibilidad: boolean
  completado: boolean
  /** Integrantes asignados, ya resueltos a nombre/inicial. */
  asignados: MiembroRef[]
  /** Nombre de quién lo agregó (registro visual). */
  agregadoPor: string | null
  /** Categoría (nombre + color), o null si no tiene. */
  categoria: CategoriaRef | null
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
  hora_fin: string | null
  afecta_disponibilidad: boolean
  completado: boolean
  asignado_a: string[] | null
  created_by: string | null
  categoria_id: string | null
}

/**
 * Mapea una fila de agenda_items a la vista, resolviendo asignados, el creador y la
 * categoría contra los mapas del hogar. Devuelve null si el tipo no es válido (drift
 * de datos). Ids que ya no resuelvan se descartan.
 */
export function mapearAgendaItem(
  r: FilaAgendaDB,
  miembros: Map<string, MiembroRef>,
  categorias: Map<string, CategoriaRef>,
): AgendaItem | null {
  if (!esTipoAgenda(r.tipo)) return null
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    fecha: r.fecha,
    hora: r.hora ? r.hora.slice(0, 5) : null, // "HH:MM:SS" -> "HH:MM"
    horaFin: r.hora_fin ? r.hora_fin.slice(0, 5) : null,
    afectaDisponibilidad: r.afecta_disponibilidad,
    completado: r.completado,
    asignados: (r.asignado_a ?? [])
      .map((id) => miembros.get(id))
      .filter((m): m is MiembroRef => m !== undefined),
    agregadoPor: r.created_by ? (miembros.get(r.created_by)?.nombre ?? null) : null,
    categoria: r.categoria_id ? (categorias.get(r.categoria_id) ?? null) : null,
  }
}

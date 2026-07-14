/**
 * Dominio de la agenda familiar: tareas y eventos puntuales. PURO: sin Next.js ni
 * Supabase. database.types tipa las columnas como string; este módulo es la fuente
 * de verdad del dominio (CLAUDE.md: enums tipados, no strings sueltos).
 */

/** 'tarea' se completa; 'evento' ocurre a una hora. */
export type TipoAgenda = 'tarea' | 'evento'

export const TIPOS_AGENDA: readonly TipoAgenda[] = ['tarea', 'evento']

export function esTipoAgenda(v: string): v is TipoAgenda {
  return (TIPOS_AGENDA as readonly string[]).includes(v)
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
}

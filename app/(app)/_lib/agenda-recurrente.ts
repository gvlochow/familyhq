import type { SupabaseClient } from "@supabase/supabase-js"

import type { AgendaItem, MiembroRef } from "@/lib/agenda/tipos"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { expandirRecurrentes } from "@/lib/agenda/recurrente"

/**
 * Carga las ocurrencias de las actividades recurrentes del hogar en [desdeISO,
 * hastaISO] (yyyy-mm-dd, inclusive), como AgendaItem listos para el feed / la tab.
 *
 * Server-side, compartido por el Inicio y Tareas: lee las reglas (RLS acota al
 * hogar) + las completaciones de la ventana, y delega la expansión a la lógica pura
 * (lib/agenda/recurrente). Vive en app/(app)/_lib porque toca Supabase.
 */
export async function cargarAgendaRecurrente(
  supabase: SupabaseClient,
  miembros: Map<string, MiembroRef>,
  categorias: Map<string, CategoriaRef>,
  desdeISO: string,
  hastaISO: string,
): Promise<AgendaItem[]> {
  const { data: reglas } = await supabase
    .from("recurring_activities")
    .select(
      "id, tipo, titulo, hora, hora_fin, afecta_disponibilidad, recurrence, asignado_a, fecha_inicio, fecha_fin, created_by, categoria_id",
    )

  if (!reglas?.length) return []

  const { data: comps } = await supabase
    .from("recurring_completions")
    .select("recurring_activity_id, fecha")
    .gte("fecha", desdeISO)
    .lte("fecha", hastaISO)

  const completadas = new Set((comps ?? []).map((c) => `${c.recurring_activity_id}:${c.fecha}`))

  return expandirRecurrentes(reglas, completadas, desdeISO, hastaISO, miembros, categorias)
}

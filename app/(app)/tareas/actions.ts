"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { esTipoAgenda } from "@/lib/agenda/tipos"

const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Resultado uniforme de las acciones: {error} legible o {} si salió bien. */
type Resultado = { error?: string }

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/** Miembro (id + household) del usuario autenticado, para household_id y created_by. */
async function miembroActual(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("members")
    .select("id, household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  return data
}

/** Crea una tarea o evento puntual en el hogar del usuario. */
export async function crearAgendaItem(input: {
  tipo: string
  titulo: string
  fecha: string
  hora: string | null
  asignadoA?: string[]
}): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No perteneces a un hogar." }

  const titulo = input.titulo.trim()
  if (!titulo) return { error: "Escribe un título." }
  if (!esTipoAgenda(input.tipo)) return { error: "Tipo inválido." }
  if (!RE_FECHA.test(input.fecha)) return { error: "Elige una fecha." }
  const hora = input.hora?.trim() ? input.hora.trim() : null
  if (hora && !RE_HORA.test(hora)) return { error: "Hora inválida (HH:MM)." }

  // Asignados: solo ids que sean integrantes del MISMO hogar (los demás se descartan).
  let asignadoA: string[] = []
  if (input.asignadoA?.length) {
    const { data: delHogar } = await supabase
      .from("members")
      .select("id")
      .eq("household_id", miembro.household_id)
    const validos = new Set((delHogar ?? []).map((m) => m.id))
    asignadoA = [...new Set(input.asignadoA)].filter((id) => validos.has(id))
  }

  const { error } = await supabase.from("agenda_items").insert({
    household_id: miembro.household_id,
    tipo: input.tipo,
    titulo,
    fecha: input.fecha,
    hora,
    asignado_a: asignadoA,
    created_by: miembro.id,
  })
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

/** Marca/desmarca una tarea como completada, registrando quién la completó. */
export async function marcarCompletado(id: string, completado: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No hay sesión." }

  const { error } = await supabase
    .from("agenda_items")
    .update({
      completado,
      completado_at: completado ? new Date().toISOString() : null,
      completado_por: completado ? miembro.id : null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo actualizar." }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

/** Elimina un item de la agenda. */
export async function eliminarAgendaItem(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from("agenda_items").delete().eq("id", id)
  if (error) return { error: "No se pudo eliminar." }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

/**
 * Marca/desmarca una OCURRENCIA de una actividad recurrente. El completado vive por
 * ocurrencia (recurring_completions): completar = upsert la fila (rule, fecha),
 * destildar = borrarla. RLS exige que la regla sea del hogar.
 */
export async function marcarOcurrenciaRecurrente(
  ruleId: string,
  fecha: string,
  completado: boolean,
): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No hay sesión." }
  if (!RE_ISO_DATE.test(fecha)) return { error: "Fecha inválida." }

  if (completado) {
    const { error } = await supabase.from("recurring_completions").upsert(
      {
        recurring_activity_id: ruleId,
        fecha,
        completado_por: miembro.id,
        completado_at: new Date().toISOString(),
      },
      { onConflict: "recurring_activity_id,fecha" },
    )
    if (error) return { error: "No se pudo actualizar." }
  } else {
    const { error } = await supabase
      .from("recurring_completions")
      .delete()
      .eq("recurring_activity_id", ruleId)
      .eq("fecha", fecha)
    if (error) return { error: "No se pudo actualizar." }
  }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

/** Elimina una actividad recurrente completa (sus completaciones caen por cascade). */
export async function eliminarActividadRecurrente(ruleId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from("recurring_activities").delete().eq("id", ruleId)
  if (error) return { error: "No se pudo eliminar." }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

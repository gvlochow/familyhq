"use server"

import { revalidatePath } from "next/cache"
import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/database.types"
import { TZ_LOCAL } from "@/lib/roster/types"
import { esTipoAgenda } from "@/lib/agenda/tipos"
import { esRecurrencia } from "@/lib/agenda/recurrencia"

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

/** Filtra ids de asignados a los que sean integrantes del MISMO hogar (dedup). */
async function asignadosDelHogar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  ids?: string[],
): Promise<string[]> {
  if (!ids?.length) return []
  const { data } = await supabase.from("members").select("id").eq("household_id", householdId)
  const validos = new Set((data ?? []).map((m) => m.id))
  return [...new Set(ids)].filter((id) => validos.has(id))
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
  const asignadoA = await asignadosDelHogar(supabase, miembro.household_id, input.asignadoA)

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

/**
 * Crea una actividad RECURRENTE (regla en recurring_activities). Las ocurrencias no
 * se materializan: se expanden al leer. fecha_inicio = hoy (la regla no genera antes).
 */
export async function crearActividadRecurrente(input: {
  tipo: string
  titulo: string
  hora: string | null
  recurrence: unknown
  asignadoA?: string[]
  fechaFin?: string | null
}): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No perteneces a un hogar." }

  const titulo = input.titulo.trim()
  if (!titulo) return { error: "Escribe un título." }
  if (!esTipoAgenda(input.tipo)) return { error: "Tipo inválido." }
  if (!esRecurrencia(input.recurrence)) return { error: "Elige cuándo se repite." }
  const hora = input.hora?.trim() ? input.hora.trim() : null
  if (hora && !RE_HORA.test(hora)) return { error: "Hora inválida (HH:MM)." }
  const fechaFin = input.fechaFin?.trim() ? input.fechaFin.trim() : null
  if (fechaFin && !RE_FECHA.test(fechaFin)) return { error: "Fecha de término inválida." }

  const asignadoA = await asignadosDelHogar(supabase, miembro.household_id, input.asignadoA)
  const hoy = DateTime.now().setZone(TZ_LOCAL).toISODate()!

  const { error } = await supabase.from("recurring_activities").insert({
    household_id: miembro.household_id,
    tipo: input.tipo,
    titulo,
    hora,
    recurrence: input.recurrence as Json,
    asignado_a: asignadoA,
    fecha_inicio: hoy,
    fecha_fin: fechaFin,
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

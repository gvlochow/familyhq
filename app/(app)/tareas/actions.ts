"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { esTipoAgenda } from "@/lib/agenda/tipos"

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

  const { error } = await supabase.from("agenda_items").insert({
    household_id: miembro.household_id,
    tipo: input.tipo,
    titulo,
    fecha: input.fecha,
    hora,
    created_by: miembro.id,
  })
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }

  revalidatePath("/tareas")
  revalidatePath("/")
  return {}
}

/** Marca/desmarca una tarea como completada. */
export async function marcarCompletado(id: string, completado: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("agenda_items")
    .update({ completado, completado_at: completado ? new Date().toISOString() : null })
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

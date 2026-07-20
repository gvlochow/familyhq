"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolverMemberObjetivo } from "@/app/_lib/permisos-integrante"
import { rematerializarMiembro } from "@/app/_lib/materializar-disponibilidad"
import { esRol } from "@/lib/members/rol"
import { esTipoHorario } from "@/lib/members/tipo-horario"
import { esColorCategoria } from "@/lib/agenda/categorias"

type Resultado = { error?: string }

/** household_id del usuario autenticado. */
async function hogarActual(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.household_id ?? null
}

/**
 * Cierra la sesión. Server Action: el cliente de servidor limpia las cookies de
 * auth y redirige al login. (signOut sí va por Server Action; el signIn/signUp
 * interactivos van por el cliente de browser, patrón SSR de Supabase — ver
 * PROJECT_LOG.)
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/** Renombra el hogar. RLS (households_update) acota al hogar propio. */
export async function renombrarHogar(nombre: string): Promise<Resultado> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { error: "Escribe un nombre." }
  const householdId = await hogarActual(supabase)
  if (!householdId) return { error: "No perteneces a un hogar." }

  const { data, error } = await supabase
    .from("households")
    .update({ name: n })
    .eq("id", householdId)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }
  if (!data) return { error: "No se pudo guardar." }

  revalidatePath("/ajustes")
  revalidatePath("/")
  return {}
}

/**
 * Preferencia del hogar: mostrar u ocultar el NOMBRE de la categoría junto al título
 * en la agenda (Inicio/Tareas/Calendario). El punto de color se muestra igual.
 */
export async function actualizarMostrarCategoria(valor: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const householdId = await hogarActual(supabase)
  if (!householdId) return { error: "No perteneces a un hogar." }

  const { data, error } = await supabase
    .from("households")
    .update({ mostrar_categoria: valor })
    .eq("id", householdId)
    .select("id")
    .maybeSingle()
  if (error || !data) return { error: "No se pudo guardar. Intenta de nuevo." }

  revalidatePath("/ajustes")
  revalidatePath("/")
  revalidatePath("/tareas")
  revalidatePath("/calendario")
  return {}
}

/**
 * Edita nombre/rol de un integrante. Solo perfiles ADMINISTRADOS (user_id null):
 * un integrante con cuenta propia no se edita desde acá (su nombre viene de su
 * cuenta). RLS (members_update) acota al hogar; el `.is('user_id', null)` restringe
 * a los administrados.
 */
export async function editarIntegrante(
  memberId: string,
  input: { nombre: string; rol: string; tipoHorario: string },
): Promise<Resultado> {
  const supabase = await createClient()
  const nombre = input.nombre.trim()
  if (!nombre) return { error: "Escribe el nombre." }
  if (!esRol(input.rol)) return { error: "Elige un rol válido." }
  if (!esTipoHorario(input.tipoHorario)) return { error: "Elige un tipo de horario válido." }

  const { data, error } = await supabase
    .from("members")
    .update({ display_name: nombre, rol: input.rol, tipo_horario: input.tipoHorario })
    .eq("id", memberId)
    .is("user_id", null)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }
  if (!data) return { error: "No se pudo editar a ese integrante." }

  revalidatePath("/ajustes")
  revalidatePath("/")
  return {}
}

/**
 * Guarda los buffers de traslado (min a/desde trabajo) de un integrante. El
 * permiso lo aplica resolverMemberObjetivo: uno mismo, o un administrado del hogar
 * si soy Responsable. Los valores se acotan a [0, 180] en pasos de 5 (server-side,
 * no confiar en el cliente). El recálculo de la disponibilidad lo hace el cron.
 */
export async function guardarBuffers(
  memberId: string,
  input: { salida: number; llegada: number },
): Promise<Resultado> {
  const supabase = await createClient()
  const objetivo = await resolverMemberObjetivo(supabase, memberId)
  if ("error" in objetivo) return { error: objetivo.error }

  const acotar = (n: number) =>
    Math.max(0, Math.min(180, Math.round((Number(n) || 0) / 5) * 5))

  const { data, error } = await supabase
    .from("members")
    .update({
      buffer_salida_min: acotar(input.salida),
      buffer_llegada_min: acotar(input.llegada),
    })
    .eq("id", objetivo.memberId)
    .select("id")
    .maybeSingle()
  if (error || !data) return { error: "No se pudo guardar. Intenta de nuevo." }

  // Recalcular la disponibilidad AHORA con los buffers nuevos (si no, el cambio no
  // se vería hasta la próxima corrida del cron). No crítico: el cron es el respaldo.
  try {
    await rematerializarMiembro(supabase, objetivo.memberId)
  } catch (e) {
    console.error(
      "[guardarBuffers] rematerialización falló:",
      e instanceof Error ? e.message : "error desconocido",
    )
  }

  revalidatePath("/ajustes")
  revalidatePath("/")
  revalidatePath("/calendario")
  return {}
}

/** Edita el nombre/color de una categoría. RLS acota al hogar. */
export async function editarCategoria(
  id: string,
  input: { nombre: string; color: string },
): Promise<Resultado> {
  const supabase = await createClient()
  const nombre = input.nombre.trim()
  if (!nombre) return { error: "Escribe un nombre." }
  if (!esColorCategoria(input.color)) return { error: "Elige un color." }

  const { data, error } = await supabase
    .from("categorias")
    .update({ nombre, color: input.color })
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }
  if (!data) return { error: "No se encontró la categoría." }

  revalidatePath("/ajustes")
  revalidatePath("/tareas")
  revalidatePath("/")
  revalidatePath("/calendario")
  return {}
}

/** Elimina una categoría. Los ítems que la usaban quedan SIN categoría (on delete set null). */
export async function eliminarCategoria(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .select("id")
  if (error) return { error: "No se pudo eliminar. Intenta de nuevo." }
  if (!data || data.length === 0) return { error: "No se pudo eliminar la categoría." }

  revalidatePath("/ajustes")
  revalidatePath("/tareas")
  revalidatePath("/")
  revalidatePath("/calendario")
  return {}
}

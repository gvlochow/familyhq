"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { esRol } from "@/lib/members/rol"
import { esTipoHorario } from "@/lib/members/tipo-horario"

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

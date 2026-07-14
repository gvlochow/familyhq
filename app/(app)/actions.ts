"use server"

import { revalidatePath } from "next/cache"
import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { esEstadoOverride } from "@/lib/availability/estado-override"

/** Resultado uniforme: {error} legible o {} si salió bien. */
type Resultado = { error?: string }

/** Miembro (id + household) del usuario autenticado. */
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

/**
 * Resuelve el integrante objetivo y valida que el usuario PUEDE editar su estado:
 * su propio member o un perfil administrado (user_id null) del mismo hogar. NO otro
 * titular de cuenta. (RLS ya acota al hogar; esta es la regla de alcance encima.)
 */
async function objetivoEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  yo: { id: string; household_id: string },
  memberId: string,
): Promise<{ id: string } | { error: string }> {
  const { data: target } = await supabase
    .from("members")
    .select("id, user_id, household_id")
    .eq("id", memberId)
    .maybeSingle()
  if (!target || target.household_id !== yo.household_id) {
    return { error: "Integrante inválido." }
  }
  const editable = target.id === yo.id || target.user_id === null
  if (!editable) {
    return { error: "Solo puedes cambiar tu estado o el de un perfil que administras." }
  }
  return { id: target.id }
}

/**
 * Fija una corrección manual de disponibilidad (override) para un integrante, en el
 * intervalo [inicioUtc, finUtc). Preserva la invariante de no-solape: borra los
 * overrides del integrante que solapen el nuevo intervalo antes de insertar ("lo
 * último gana"). No toca availability_segments: el estado efectivo se compone al leer.
 */
export async function actualizarMiEstado(input: {
  memberId: string
  estado: string
  inicioUtc: string
  finUtc: string
}): Promise<Resultado> {
  const supabase = await createClient()
  const yo = await miembroActual(supabase)
  if (!yo) return { error: "No perteneces a un hogar." }

  if (!esEstadoOverride(input.estado)) return { error: "Estado inválido." }
  const ini = DateTime.fromISO(input.inicioUtc)
  const fin = DateTime.fromISO(input.finUtc)
  if (!ini.isValid || !fin.isValid || fin <= ini) return { error: "Rango de tiempo inválido." }

  const objetivo = await objetivoEditable(supabase, yo, input.memberId)
  if ("error" in objetivo) return { error: objetivo.error }

  // No-solape: quita los overrides del integrante que se cruzan con el nuevo.
  const { error: delError } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("member_id", objetivo.id)
    .lt("inicio_utc", input.finUtc)
    .gt("fin_utc", input.inicioUtc)
  if (delError) return { error: "No se pudo guardar. Intenta de nuevo." }

  const { error } = await supabase.from("availability_overrides").insert({
    member_id: objetivo.id,
    inicio_utc: input.inicioUtc,
    fin_utc: input.finUtc,
    estado: input.estado,
    created_by: yo.id,
  })
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }

  revalidatePath("/")
  revalidatePath("/calendario")
  return {}
}

/**
 * "Volver a lo automático": elimina las correcciones manuales vigentes o futuras del
 * integrante (fin_utc > ahora), para que vuelva a mandar lo clasificado. Las pasadas
 * se dejan (ya no afectan la lectura y son inofensivas).
 */
export async function limpiarMiEstado(memberId: string): Promise<Resultado> {
  const supabase = await createClient()
  const yo = await miembroActual(supabase)
  if (!yo) return { error: "No perteneces a un hogar." }

  const objetivo = await objetivoEditable(supabase, yo, memberId)
  if ("error" in objetivo) return { error: objetivo.error }

  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("member_id", objetivo.id)
    .gt("fin_utc", new Date().toISOString())
  if (error) return { error: "No se pudo actualizar. Intenta de nuevo." }

  revalidatePath("/")
  revalidatePath("/calendario")
  return {}
}

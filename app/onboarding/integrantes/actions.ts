"use server"

import { createClient } from "@/lib/supabase/server"
import { esRol, type Rol } from "@/lib/members/rol"
import { esTipoHorario, type TipoHorario } from "@/lib/members/tipo-horario"

type Result = { error: string | null }

/**
 * Paso 4 del onboarding (opcional): agrega un integrante al hogar como PERFIL
 * ADMINISTRADO (sin cuenta propia, user_id = null). Lo maneja el sostenedor;
 * si esa persona más adelante se registra, se vincula su cuenta (transición
 * blindada por trigger). Ver migración 20260708130324.
 *
 * Mutación de dominio → Server Action con el cliente de servidor: la RLS de
 * members aplica. members_insert permite user_id IS NULL solo dentro del propio
 * household (household_id = current_household_id()), que es justo lo que hacemos.
 */
export async function agregarIntegrante(input: {
  nombre: string
  rol: Rol
  tipoHorario: TipoHorario
}): Promise<Result> {
  const nombre = input.nombre.trim()
  if (!nombre) return { error: "Escribe el nombre del integrante." }
  if (!esRol(input.rol)) return { error: "Elige un rol válido." }
  if (!esTipoHorario(input.tipoHorario)) {
    return { error: "Elige un tipo de horario válido." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }

  const { data: yo, error: yoError } = await supabase
    .from("members")
    .select("id, household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (yoError || !yo) return { error: "No encontramos tu hogar. Intenta de nuevo." }

  const { error } = await supabase.from("members").insert({
    household_id: yo.household_id,
    user_id: null,
    display_name: nombre,
    rol: input.rol,
    tipo_horario: input.tipoHorario,
    is_owner: false,
    created_by_member_id: yo.id,
  })
  if (error) return { error: "No pudimos agregar al integrante. Intenta de nuevo." }

  return { error: null }
}

/**
 * Marca el onboarding del hogar como completado (households.onboarding_completed).
 * Lo llaman "Continuar" y "Omitir por ahora": ambos cierran el onboarding. Tras
 * esto, getPostLoginRedirect deja de mandar al paso de integrantes y el usuario
 * queda en el home. El cliente hace router.refresh() para que la guarda reevalúe.
 */
export async function completarOnboarding(): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }

  const { data: yo, error: yoError } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (yoError || !yo) return { error: "No encontramos tu hogar. Intenta de nuevo." }

  const { error } = await supabase
    .from("households")
    .update({ onboarding_completed: true })
    .eq("id", yo.household_id)
  if (error) return { error: "No pudimos completar el onboarding. Intenta de nuevo." }

  return { error: null }
}

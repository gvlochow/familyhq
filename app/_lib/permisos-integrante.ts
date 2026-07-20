import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

/**
 * Resuelve el `member_id` OBJETIVO de una acción de configuración de horario
 * (horario fijo o conexión de calendario), aplicando el permiso a nivel de app.
 *
 * - **Sin `targetMemberId`**: el propio member del usuario en sesión (configura lo suyo).
 * - **Con `targetMemberId`**: exige que el usuario sea **Responsable** (rol `sostenedor`)
 *   y que el objetivo sea un perfil **ADMINISTRADO** (`user_id` null) de su mismo hogar.
 *
 * La RLS de fixed_schedules/roster_connections es por-hogar (no por-uno-mismo): deja
 * a cualquier integrante tocar filas de cualquier member del hogar. Por eso el gate
 * "solo responsables, solo administrados" vive acá, en la capa de aplicación, y NO
 * puede omitirse llamando la Server Action con otro member_id.
 *
 * Vive en app/**\/_lib (toca Supabase, no puede ir en lib/ — CLAUDE.md).
 */
export async function resolverMemberObjetivo(
  supabase: SupabaseClient<Database>,
  targetMemberId?: string,
): Promise<{ memberId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }

  const { data: yo } = await supabase
    .from("members")
    .select("id, rol, household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!yo) return { error: "No encontramos tu hogar. Intenta de nuevo." }

  // Sin objetivo explícito: configura su propio horario.
  if (!targetMemberId || targetMemberId === yo.id) return { memberId: yo.id }

  // Objetivo ajeno: solo un responsable, y solo sobre perfiles administrados del hogar.
  if (yo.rol !== "sostenedor") {
    return {
      error: "Solo un responsable puede configurar el horario de un integrante.",
    }
  }
  const { data: objetivo } = await supabase
    .from("members")
    .select("id, user_id, household_id")
    .eq("id", targetMemberId)
    .maybeSingle()
  if (
    !objetivo ||
    objetivo.household_id !== yo.household_id ||
    objetivo.user_id !== null
  ) {
    return { error: "No puedes configurar el horario de ese integrante." }
  }
  return { memberId: objetivo.id }
}

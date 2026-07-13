"use server"

import { createClient } from "@/lib/supabase/server"
import {
  esTipoHorarioSeleccionable,
  type TipoHorarioSeleccionable,
} from "@/lib/members/tipo-horario"

type SetTipoHorarioResult = { error: string | null }

/**
 * Paso 2 del onboarding: define members.tipo_horario del usuario en sesión.
 *
 * Es una mutación de dominio → Server Action (convención del proyecto), no una
 * llamada desde el cliente. Corre con el cliente de servidor (sesión vía
 * cookies), así que la RLS de members aplica: la política members_update solo
 * deja tocar filas del hogar propio (household_id = current_household_id()), y
 * el trigger de user_id no bloquea cambios de tipo_horario.
 *
 * No calcula el destino siguiente: devuelve el resultado y el cliente hace
 * router.refresh() para que la guarda server-side reevalúe (mismo patrón que
 * crear hogar). Idempotente: reelegir el tipo no rompe nada.
 */
export async function setTipoHorario(
  tipo: TipoHorarioSeleccionable
): Promise<SetTipoHorarioResult> {
  if (!esTipoHorarioSeleccionable(tipo)) {
    return { error: "Elige un tipo de horario para continuar." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }
  }

  const { data: yo, error: yoError } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (yoError || !yo) {
    return { error: "No encontramos tu hogar. Intenta de nuevo." }
  }

  const { error } = await supabase
    .from("members")
    .update({ tipo_horario: tipo })
    .eq("id", yo.id)

  if (error) {
    return {
      error: "No pudimos guardar tu tipo de horario. Intenta de nuevo.",
    }
  }

  // Al cambiar de tipo (posible al volver atrás en el onboarding), se descarta la
  // configuración del OTRO tipo para no dejar datos huérfanos. Crítico en el caso
  // 'variable' -> 'fijo': elimina la URL iCal cifrada (dato sensible, Ley 19.628)
  // que ya no corresponde. Idempotente: si no hay filas, es un no-op.
  if (tipo === "fijo") {
    await supabase.from("roster_connections").delete().eq("member_id", yo.id)
  } else if (tipo === "variable") {
    await supabase.from("fixed_schedules").delete().eq("member_id", yo.id)
  }

  return { error: null }
}

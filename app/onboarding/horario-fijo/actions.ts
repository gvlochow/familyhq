"use server"

import { createClient } from "@/lib/supabase/server"
import {
  validarBloques,
  type BloqueDia,
} from "@/lib/members/horario-fijo"

type SaveResult = { error: string | null }

/**
 * Paso 3 (camino 'fijo'): guarda el horario fijo por día del usuario en sesión.
 *
 * Mutación de dominio → Server Action (cliente de servidor, RLS aplica: la
 * política de fixed_schedules solo deja tocar filas de integrantes del hogar
 * propio, vía join a members). Idempotente: reguardar sobrescribe (upsert por
 * (member_id, dia_semana)).
 *
 * No calcula el destino siguiente: devuelve el resultado y el cliente hace
 * router.refresh() para que la guarda server-side reevalúe.
 */
export async function saveHorarioFijo(
  bloques: BloqueDia[]
): Promise<SaveResult> {
  const errorValidacion = validarBloques(bloques)
  if (errorValidacion) {
    return { error: errorValidacion }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberError || !member) {
    return { error: "No encontramos tu hogar. Intenta de nuevo." }
  }

  // Un día sin trabajo se persiste con horas en null (así lo lee el clasificador
  // de disponibilidad). El almuerzo solo se guarda si trabaja y va a casa.
  // onConflict por la unique (member_id, dia_semana).
  const filas = bloques.map((b) => {
    const almuerza = b.trabaja && b.almuerzaEnCasa
    return {
      member_id: member.id,
      dia_semana: b.dia,
      hora_inicio: b.trabaja ? b.horaInicio : null,
      hora_fin: b.trabaja ? b.horaFin : null,
      almuerza_en_casa: almuerza,
      hora_almuerzo_inicio: almuerza ? b.horaAlmuerzoInicio : null,
      hora_almuerzo_fin: almuerza ? b.horaAlmuerzoFin : null,
    }
  })

  const { error } = await supabase
    .from("fixed_schedules")
    .upsert(filas, { onConflict: "member_id,dia_semana" })

  if (error) {
    return { error: "No pudimos guardar tu horario. Intenta de nuevo." }
  }

  return { error: null }
}

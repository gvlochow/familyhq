"use server"

import { createClient } from "@/lib/supabase/server"
import { resolverMemberObjetivo } from "@/app/_lib/permisos-integrante"
import { rematerializarMiembro } from "@/app/_lib/materializar-disponibilidad"
import {
  validarBloques,
  type BloqueDia,
} from "@/lib/members/horario-fijo"

type SaveResult = { error: string | null }

/**
 * Guarda el horario fijo por día. Sin `opts.memberId`, sobre el propio usuario
 * (paso 3 del onboarding / "Mi horario" en Ajustes). Con `opts.memberId`, sobre un
 * perfil administrado del hogar (un Responsable configura el horario de un
 * integrante) — el permiso lo resuelve resolverMemberObjetivo.
 *
 * Mutación de dominio → Server Action (cliente de servidor, RLS aplica: la
 * política de fixed_schedules solo deja tocar filas de integrantes del hogar
 * propio, vía join a members). Idempotente: reguardar sobrescribe (upsert por
 * (member_id, dia_semana)).
 */
export async function saveHorarioFijo(
  bloques: BloqueDia[],
  opts?: { memberId?: string },
): Promise<SaveResult> {
  const errorValidacion = validarBloques(bloques)
  if (errorValidacion) {
    return { error: errorValidacion }
  }

  const supabase = await createClient()
  const objetivo = await resolverMemberObjetivo(supabase, opts?.memberId)
  if ("error" in objetivo) {
    return { error: objetivo.error }
  }

  // Un día sin trabajo se persiste con horas en null (así lo lee el clasificador
  // de disponibilidad). El almuerzo solo se guarda si trabaja y va a casa.
  // onConflict por la unique (member_id, dia_semana).
  const filas = bloques.map((b) => {
    const almuerza = b.trabaja && b.almuerzaEnCasa
    return {
      member_id: objetivo.memberId,
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

  // Recalcular la disponibilidad AHORA (si no, el horario nuevo no se vería hasta la
  // próxima corrida del cron). No crítico: el cron es el respaldo.
  try {
    await rematerializarMiembro(supabase, objetivo.memberId)
  } catch (e) {
    console.error(
      "[saveHorarioFijo] rematerialización falló:",
      e instanceof Error ? e.message : "error desconocido",
    )
  }

  return { error: null }
}

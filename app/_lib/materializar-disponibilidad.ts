import type { SupabaseClient } from "@supabase/supabase-js"

import type { RosterEvent } from "@/lib/roster"
import {
  construirSegmentos,
  limitesVentanaUtc,
  type Segmento,
} from "@/lib/roster/segments"
import { ventanaPorDefecto } from "@/lib/roster/ingest"

/**
 * Materialización de la disponibilidad del rol VARIABLE en availability_segments.
 *
 * Compartido por el cron de ingesta (app/api/cron/roster) y por connectCalendar
 * (sync al enlazar, app/onboarding/calendario): ambos clasifican eventos de rol a
 * tramos intra-día y los persisten con la MISMA lógica, para que no se dupliquen ni
 * se desincronicen. Toca Supabase, así que vive en app/**\/_lib y no en lib/
 * (dominio puro, sin Supabase — ver CLAUDE.md). Recibe el cliente ya creado: admin
 * en el cron (salta RLS), o el de sesión en connectCalendar (RLS lo acota al hogar).
 */

/**
 * Ventana de materialización: bordes en fecha local (para construirSegmentos) y en
 * UTC (para acotar el borrado). Es la ventana [mes actual, +3 meses] del cron.
 */
export type VentanaMaterializacion = {
  desde: string
  hasta: string
  inicioUtc: string
  finUtc: string
}

/** La ventana por defecto ([mes actual, +3 meses]) resuelta en un solo lugar. */
export function ventanaMaterializacion(hoyISO?: string): VentanaMaterializacion {
  const { desde, hasta } = ventanaPorDefecto(hoyISO)
  const { inicioUtc, finUtc } = limitesVentanaUtc(desde, hasta)
  return { desde, hasta, inicioUtc, finUtc }
}

/**
 * Reemplaza los tramos de un integrante dentro de la ventana: borra los existentes
 * y reinserta los recalculados. Delete+insert (no upsert) porque la clave de un
 * tramo es su inicio_utc, que cambia entre corridas. Si el insert fallara tras el
 * delete, la ventana queda vacía hasta la próxima corrida (el proceso es idempotente).
 */
export async function escribirSegmentos(
  supabase: SupabaseClient,
  memberId: string,
  segmentos: Segmento[],
  ventana: VentanaMaterializacion,
  nowISO: string,
): Promise<boolean> {
  const { error: delError } = await supabase
    .from("availability_segments")
    .delete()
    .eq("member_id", memberId)
    .gte("inicio_utc", ventana.inicioUtc)
    .lt("inicio_utc", ventana.finUtc)

  if (delError) {
    console.error(`[materializar] member ${memberId}: borrado de tramos falló:`, delError.message)
    return false
  }

  if (segmentos.length === 0) return true

  const { error: insError } = await supabase.from("availability_segments").insert(
    segmentos.map((s) => ({
      member_id: memberId,
      inicio_utc: s.inicioUtc.toISO()!,
      fin_utc: s.finUtc.toISO()!,
      estado: s.estado,
      source: "clasificado" as const,
      source_event_hash: null,
      updated_at: nowISO,
    })),
  )

  if (insError) {
    console.error(`[materializar] member ${memberId}: insert de tramos falló:`, insError.message)
    return false
  }
  return true
}

/**
 * Clasifica eventos de rol ya parseados a tramos sobre la ventana por defecto y los
 * materializa para un integrante. Reusa la salida del clasificador que el llamador ya
 * tiene en memoria (connectCalendar la usa para evitar un segundo fetch/parseo del
 * feed). Devuelve true si la disponibilidad quedó materializada.
 */
export async function materializarDisponibilidadVariable(
  supabase: SupabaseClient,
  memberId: string,
  events: RosterEvent[],
  bufferLlegadaMin: number | null | undefined,
  bufferSalidaMin: number | null | undefined,
  nowISO: string = new Date().toISOString(),
): Promise<boolean> {
  const ventana = ventanaMaterializacion()
  const segmentos = construirSegmentos(
    events,
    ventana.desde,
    ventana.hasta,
    bufferLlegadaMin ?? undefined,
    bufferSalidaMin ?? undefined,
  )
  return escribirSegmentos(supabase, memberId, segmentos, ventana, nowISO)
}

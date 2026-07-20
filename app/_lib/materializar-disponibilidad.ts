import type { SupabaseClient } from "@supabase/supabase-js"

import { loadRosterEvents, type RosterEvent } from "@/lib/roster"
import {
  construirSegmentos,
  limitesVentanaUtc,
  type Segmento,
} from "@/lib/roster/segments"
import { ventanaPorDefecto } from "@/lib/roster/ingest"
import { fetchFeedSeguro } from "@/lib/roster/fetch-seguro"
import { decryptSecret } from "@/lib/crypto/secret-box"
import {
  construirSegmentosFijo,
  type FilaHorarioFijo,
} from "@/lib/availability/fijo-segmentos"

const FETCH_TIMEOUT_MS = 12_000

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

/**
 * Re-materializa la disponibilidad de UN integrante AHORA, con sus datos actuales
 * (buffers, horario). Para que un cambio de horario fijo o de buffers se vea al
 * instante en vez de esperar la próxima corrida del cron ("guardé y no pasó nada").
 *
 * - variable: descifra la URL, baja el feed (descarta lo no-iFlight en memoria) y
 *   reclasifica con los buffers actuales.
 * - fijo: re-expande el horario semanal con los buffers actuales.
 * - ninguno / sin conexión / sin bloques: no hay nada que materializar (false).
 *
 * Idempotente y no crítica: si falla (p. ej. el feed no responde) devuelve false y
 * el cron es el respaldo. NUNCA loguea la URL ni el contenido del calendario.
 */
export async function rematerializarMiembro(
  supabase: SupabaseClient,
  memberId: string,
): Promise<boolean> {
  const nowISO = new Date().toISOString()

  const { data: m } = await supabase
    .from("members")
    .select("tipo_horario, buffer_llegada_min, buffer_salida_min")
    .eq("id", memberId)
    .maybeSingle()
  if (!m) return false

  if (m.tipo_horario === "variable") {
    const { data: conn } = await supabase
      .from("roster_connections")
      .select("ical_url_encrypted")
      .eq("member_id", memberId)
      .maybeSingle()
    if (!conn) return false // aún no conecta su calendario

    const url = decryptSecret(conn.ical_url_encrypted)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let ics: string
    try {
      const res = await fetchFeedSeguro(url, { signal: controller.signal })
      if (!res.ok) return false
      ics = await res.text()
    } finally {
      clearTimeout(timeout)
    }
    const events = loadRosterEvents(ics)
    return materializarDisponibilidadVariable(
      supabase,
      memberId,
      events,
      m.buffer_llegada_min,
      m.buffer_salida_min,
      nowISO,
    )
  }

  if (m.tipo_horario === "fijo") {
    const { data: filas } = await supabase
      .from("fixed_schedules")
      .select(
        "dia_semana, hora_inicio, hora_fin, almuerza_en_casa, hora_almuerzo_inicio, hora_almuerzo_fin",
      )
      .eq("member_id", memberId)
    if (!filas || filas.length === 0) return false

    const dominio: FilaHorarioFijo[] = filas.map((f) => ({
      diaSemana: f.dia_semana,
      horaInicio: f.hora_inicio,
      horaFin: f.hora_fin,
      almuerzaEnCasa: f.almuerza_en_casa,
      horaAlmuerzoInicio: f.hora_almuerzo_inicio,
      horaAlmuerzoFin: f.hora_almuerzo_fin,
    }))
    const ventana = ventanaMaterializacion()
    const segmentos = construirSegmentosFijo(
      dominio,
      ventana.desde,
      ventana.hasta,
      m.buffer_llegada_min,
      m.buffer_salida_min,
    )
    return escribirSegmentos(supabase, memberId, segmentos, ventana, nowISO)
  }

  return false // tipo 'ninguno': sin tramos que materializar
}

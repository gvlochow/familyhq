import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret } from "@/lib/crypto/secret-box"
import { loadRosterEvents } from "@/lib/roster"
import {
  construirSegmentos,
  limitesVentanaUtc,
  type Segmento,
} from "@/lib/roster/segments"
import { ventanaPorDefecto } from "@/lib/roster/ingest"
import {
  construirSegmentosFijo,
  type FilaHorarioFijo,
} from "@/lib/availability/fijo-segmentos"

/**
 * Cron de ingesta y materialización de la disponibilidad.
 *
 * Corre en el runtime de la app —no en Edge ni pg_cron— porque el descifrado de
 * la URL (secret-box, server-only) y el clasificador viven acá. Lo dispara Vercel
 * Cron (ver vercel.json) con `Authorization: Bearer $CRON_SECRET`; el endpoint es
 * agnóstico al disparador (sirve igual con un scheduler externo).
 *
 * Dos pasadas, sobre la misma ventana [mes actual, +3 meses]:
 *
 *  A) VARIABLE (roster_connections). Por conexión:
 *     1. Descifra la URL y hace UN fetch del feed (con timeout).
 *     2. loadRosterEvents descarta en memoria todo evento sin firma iFlight
 *        (privacidad, Ley 19.628): jamás se persiste ni se loguea el contenido.
 *     3. Clasifica la ventana a tramos intra-día y escribe availability_segments.
 *     Se recalcula SIEMPRE (no se salta por hash de feed): la ventana es relativa
 *     a hoy y avanza cada mes. La clasificación es en memoria y barata.
 *
 *  B) FIJO (fixed_schedules de members con tipo_horario='fijo'). Expande el
 *     horario semanal a tramos (jornada FUERA, mañana/tarde/almuerzo EN_CASA) y
 *     escribe availability_segments.
 *
 * Los tramos se persisten borrando la ventana del integrante y reinsertando (el
 * upsert no sirve: la clave inicio_utc cambia entre corridas). Nota de override:
 * los tramos se escriben como 'clasificado'; aplicar correcciones manuales sobre
 * tramos se resolverá junto con la UI de corrección (feature futura).
 *
 * Un integrante que falla no tumba al resto: cada uno va en su propio try/catch.
 */

export const runtime = "nodejs" // usa node:crypto y clientes server-only
export const dynamic = "force-dynamic"
export const maxDuration = 60

const FETCH_TIMEOUT_MS = 12_000

type ResumenConexion =
  | { estado: "actualizada"; dias: number }
  | { estado: "error" }

type Ventana = { desde: string; hasta: string; inicioUtc: string; finUtc: string }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { desde, hasta } = ventanaPorDefecto()
  const { inicioUtc, finUtc } = limitesVentanaUtc(desde, hasta)
  const ventana: Ventana = { desde, hasta, inicioUtc, finUtc }

  const variable = await procesarVariables(supabase, ventana)
  const fijo = await procesarFijos(supabase, ventana)

  return NextResponse.json({
    ok: true,
    actualizadas: variable.actualizadas,
    errores: variable.errores,
    fijosActualizados: fijo.actualizados,
    fijosErrores: fijo.errores,
  })
}

// =============================================================================
// A) Pasada VARIABLE (rol irregular vía roster_connections)
// =============================================================================

type Conexion = {
  id: string
  member_id: string
  ical_url_encrypted: string
  members: { buffer_llegada_min: number } | null
}

async function procesarVariables(
  supabase: ReturnType<typeof createAdminClient>,
  ventana: Ventana,
): Promise<{ actualizadas: number; errores: number }> {
  const { data: conexiones, error } = await supabase
    .from("roster_connections")
    .select("id, member_id, ical_url_encrypted, members(buffer_llegada_min)")

  if (error) {
    console.error("[cron/roster] no se pudieron leer las conexiones:", error.message)
    return { actualizadas: 0, errores: 0 }
  }

  const resumen = { actualizadas: 0, errores: 0 }
  for (const conexion of conexiones ?? []) {
    // Nota de privacidad: en errores solo se loguea el id de la conexión, NUNCA
    // la URL ni nada del contenido del calendario.
    try {
      const r = await procesarConexion(supabase, conexion, ventana)
      if (r.estado === "actualizada") resumen.actualizadas++
      else resumen.errores++
    } catch (e) {
      resumen.errores++
      console.error(
        `[cron/roster] fallo procesando conexion ${conexion.id}:`,
        e instanceof Error ? e.message : "error desconocido",
      )
    }
  }
  return resumen
}

async function procesarConexion(
  supabase: ReturnType<typeof createAdminClient>,
  conexion: Conexion,
  ventana: Ventana,
): Promise<ResumenConexion> {
  const { desde, hasta } = ventana
  const url = decryptSecret(conexion.ical_url_encrypted)

  // 1. Fetch del feed con timeout.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let ics: string
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`[cron/roster] conexion ${conexion.id}: HTTP ${res.status}`)
      return { estado: "error" }
    }
    ics = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  // 2. Hash del feed: informativo (se guarda en last_fetch_hash), NO se usa para
  //    saltar el recálculo — ver nota de cabecera.
  const feedHash = createHash("sha256").update(ics).digest("hex")
  const nowISO = new Date().toISOString()

  // 3. Parseo con filtrado de privacidad (lo no-iFlight se descarta en memoria).
  const events = loadRosterEvents(ics)
  const buffer = conexion.members?.buffer_llegada_min

  // 4. Clasificar la ventana a tramos y materializar en availability_segments.
  const segmentos = construirSegmentos(events, desde, hasta, buffer)
  const okSegs = await escribirSegmentos(supabase, conexion.member_id, segmentos, ventana, nowISO)
  if (!okSegs) return { estado: "error" }

  await supabase
    .from("roster_connections")
    .update({ last_fetch_hash: feedHash, last_synced_at: nowISO })
    .eq("id", conexion.id)

  return { estado: "actualizada", dias: segmentos.length }
}

// =============================================================================
// B) Pasada FIJO (horario fijo vía fixed_schedules)
// =============================================================================

type FilaFixed = {
  member_id: string
  dia_semana: number
  hora_inicio: string | null
  hora_fin: string | null
  almuerza_en_casa: boolean
  hora_almuerzo_inicio: string | null
  hora_almuerzo_fin: string | null
}

async function procesarFijos(
  supabase: ReturnType<typeof createAdminClient>,
  ventana: Ventana,
): Promise<{ actualizados: number; errores: number }> {
  const { data, error } = await supabase
    .from("fixed_schedules")
    .select(
      "member_id, dia_semana, hora_inicio, hora_fin, almuerza_en_casa, hora_almuerzo_inicio, hora_almuerzo_fin, members!inner(tipo_horario)",
    )
    .eq("members.tipo_horario", "fijo")

  if (error) {
    console.error("[cron/roster] no se pudieron leer los horarios fijos:", error.message)
    return { actualizados: 0, errores: 0 }
  }

  // Agrupar las filas semanales por integrante.
  const porMember = new Map<string, FilaHorarioFijo[]>()
  for (const f of (data ?? []) as unknown as FilaFixed[]) {
    const filas = porMember.get(f.member_id) ?? []
    filas.push({
      diaSemana: f.dia_semana,
      horaInicio: f.hora_inicio,
      horaFin: f.hora_fin,
      almuerzaEnCasa: f.almuerza_en_casa,
      horaAlmuerzoInicio: f.hora_almuerzo_inicio,
      horaAlmuerzoFin: f.hora_almuerzo_fin,
    })
    porMember.set(f.member_id, filas)
  }

  const nowISO = new Date().toISOString()
  const resumen = { actualizados: 0, errores: 0 }
  for (const [memberId, filas] of porMember) {
    try {
      const segmentos = construirSegmentosFijo(filas, ventana.desde, ventana.hasta)
      const ok = await escribirSegmentos(supabase, memberId, segmentos, ventana, nowISO)
      if (ok) resumen.actualizados++
      else resumen.errores++
    } catch (e) {
      resumen.errores++
      console.error(
        `[cron/roster] fallo procesando horario fijo del member ${memberId}:`,
        e instanceof Error ? e.message : "error desconocido",
      )
    }
  }
  return resumen
}

// =============================================================================
// Persistencia de tramos (compartida por ambas pasadas)
// =============================================================================

/**
 * Reemplaza los tramos de un integrante dentro de la ventana: borra los existentes
 * y reinserta los recalculados. Delete+insert (no upsert) porque la clave de un
 * tramo es su inicio_utc, que cambia entre corridas. Si el insert fallara tras el
 * delete, la ventana queda vacía hasta la próxima corrida (el cron es idempotente).
 */
async function escribirSegmentos(
  supabase: ReturnType<typeof createAdminClient>,
  memberId: string,
  segmentos: Segmento[],
  ventana: Ventana,
  nowISO: string,
): Promise<boolean> {
  const { error: delError } = await supabase
    .from("availability_segments")
    .delete()
    .eq("member_id", memberId)
    .gte("inicio_utc", ventana.inicioUtc)
    .lt("inicio_utc", ventana.finUtc)

  if (delError) {
    console.error(`[cron/roster] member ${memberId}: borrado de tramos falló:`, delError.message)
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
    console.error(`[cron/roster] member ${memberId}: insert de tramos falló:`, insError.message)
    return false
  }
  return true
}

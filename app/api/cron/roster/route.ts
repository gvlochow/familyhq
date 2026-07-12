import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret } from "@/lib/crypto/secret-box"
import { loadRosterEvents } from "@/lib/roster"
import {
  aplicarOverrides,
  construirFilasDisponibilidad,
  ventanaPorDefecto,
  type OverrideDia,
} from "@/lib/roster/ingest"

/**
 * Cron de ingesta y clasificación del rol (pendiente priorizado del PROJECT_LOG).
 *
 * Corre en el runtime de la app —no en Edge ni pg_cron— porque el descifrado de
 * la URL (secret-box, server-only) y el clasificador viven acá. Lo dispara Vercel
 * Cron (ver vercel.json) con `Authorization: Bearer $CRON_SECRET`; el endpoint es
 * agnóstico al disparador (sirve igual con un scheduler externo).
 *
 * Por cada roster_connection:
 *   1. Descifra la URL y hace UN fetch del feed (con timeout).
 *   2. loadRosterEvents descarta en memoria todo evento sin firma iFlight
 *      (privacidad, Ley 19.628): jamás se persiste ni se loguea el contenido.
 *   3. Clasifica la ventana [mes actual, +3 meses], resuelve overrides y hace
 *      upsert en availability_days. Se recalcula SIEMPRE (no se salta por hash
 *      de feed): la ventana es relativa a hoy y avanza cada mes, y la precedencia
 *      de override debe reaplicarse en cada corrida aunque el feed no cambie —
 *      saltar por hash omitía ambas cosas. La clasificación es en memoria y barata.
 *   4. Actualiza last_fetch_hash (informativo) + last_synced_at.
 *
 * Un feed que falla no tumba al resto: cada conexión va en su propio try/catch.
 */

export const runtime = "nodejs" // usa node:crypto y clientes server-only
export const dynamic = "force-dynamic"
export const maxDuration = 60

const FETCH_TIMEOUT_MS = 12_000

type ResumenConexion =
  | { estado: "actualizada"; dias: number }
  | { estado: "error" }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: conexiones, error: connError } = await supabase
    .from("roster_connections")
    .select("id, member_id, ical_url_encrypted, members(buffer_llegada_min)")

  if (connError) {
    console.error("[cron/roster] no se pudieron leer las conexiones:", connError.message)
    return NextResponse.json({ error: "error al leer conexiones" }, { status: 500 })
  }

  const resumen = { actualizadas: 0, errores: 0 }
  const { desde, hasta } = ventanaPorDefecto()

  for (const conexion of conexiones ?? []) {
    // Nota de privacidad: en errores solo se loguea el id de la conexión, NUNCA
    // la URL ni nada del contenido del calendario.
    try {
      const r = await procesarConexion(supabase, conexion, desde, hasta)
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

  return NextResponse.json({ ok: true, ...resumen })
}

type Conexion = {
  id: string
  member_id: string
  ical_url_encrypted: string
  members: { buffer_llegada_min: number } | null
}

async function procesarConexion(
  supabase: ReturnType<typeof createAdminClient>,
  conexion: Conexion,
  desde: string,
  hasta: string,
): Promise<ResumenConexion> {
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

  // 4. Clasificar la ventana y resolver overrides.
  const buffer = conexion.members?.buffer_llegada_min
  const filasClasificadas = construirFilasDisponibilidad(events, desde, hasta, buffer)

  const { data: overridesRaw } = await supabase
    .from("availability_overrides")
    .select("date, estado, source_event_hash_at_override")
    .eq("member_id", conexion.member_id)
    .gte("date", desde)
    .lte("date", hasta)

  const overrides: OverrideDia[] = (overridesRaw ?? []).map((o) => ({
    fecha: o.date,
    estado: o.estado,
    sourceEventHashAtOverride: o.source_event_hash_at_override,
  }))

  const filas = aplicarOverrides(filasClasificadas, overrides)

  // 5. Upsert de availability_days (unique member_id, date).
  const { error: upsertError } = await supabase.from("availability_days").upsert(
    filas.map((f) => ({
      member_id: conexion.member_id,
      date: f.fecha,
      estado: f.estado,
      source: f.source,
      source_event_hash: f.sourceEventHash,
      updated_at: nowISO,
    })),
    { onConflict: "member_id,date" },
  )

  if (upsertError) {
    console.error(`[cron/roster] conexion ${conexion.id}: upsert falló:`, upsertError.message)
    return { estado: "error" }
  }

  await supabase
    .from("roster_connections")
    .update({ last_fetch_hash: feedHash, last_synced_at: nowISO })
    .eq("id", conexion.id)

  return { estado: "actualizada", dias: filas.length }
}

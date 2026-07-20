"use server"

import { createClient } from "@/lib/supabase/server"
import { encryptSecret } from "@/lib/crypto/secret-box"
import { loadRosterEvents, type RosterEvent } from "@/lib/roster"
import { fetchFeedSeguro } from "@/lib/roster/fetch-seguro"
import { materializarDisponibilidadVariable } from "@/app/_lib/materializar-disponibilidad"

type ConnectResult = { error: string | null }

const FETCH_TIMEOUT_MS = 12_000

/**
 * Paso 3 (camino 'variable'): conecta el feed iCal secreto del rol.
 *
 * Flujo:
 *   1. Normaliza y valida la URL (https; webcal:// se reescribe a https://).
 *   2. Hace UN fetch de validación y lo parsea con loadRosterEvents, que
 *      descarta en memoria todo evento sin la firma iFlight (requisito de
 *      privacidad, Ley 19.628). Si no hay eventos de rol, la URL no sirve.
 *   3. Cifra la URL en la app (AES-256-GCM), hace upsert en roster_connections y
 *      MATERIALIZA la disponibilidad al instante reusando los eventos ya
 *      clasificados en memoria (sin fetch extra). Sin esto, la disponibilidad no
 *      aparecería hasta la próxima corrida del cron (diaria) y el usuario ve
 *      "guardé y no pasó nada".
 *
 * NUNCA se persiste ni se loguea el contenido del calendario ni la URL en claro.
 * No calcula el destino: devuelve el resultado y el cliente hace router.refresh().
 */
export async function connectCalendar(urlCruda: string): Promise<ConnectResult> {
  const url = normalizarUrl(urlCruda)
  if (!url) {
    return {
      error: "Pega la dirección iCal completa (debe empezar con https://).",
    }
  }

  // Sesión y rate limit ANTES del fetch: la validación dispara una petición a una
  // URL externa provista por el usuario (primitiva de fetch repetible). Exigir
  // sesión y acotar los intentos por usuario evita usar la action como proxy de
  // fetch. El límite vive en Postgres porque en serverless no hay estado en
  // memoria compartido entre invocaciones.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }
  }

  const { data: dentroDelLimite, error: rateError } = await supabase.rpc(
    "consumir_rate_limit",
    { p_accion: "connect_calendar", p_limite: 10, p_ventana_seg: 600 },
  )
  if (rateError) {
    return { error: "No pudimos procesar la solicitud. Intenta de nuevo." }
  }
  if (dentroDelLimite === false) {
    return {
      error:
        "Demasiados intentos seguidos. Espera unos minutos antes de volver a probar.",
    }
  }

  // 1. Fetch de validación (con timeout).
  let ics: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetchFeedSeguro(url, { signal: controller.signal })
      if (!res.ok) {
        return {
          error:
            "No pudimos acceder a ese calendario. Revisa que la dirección sea la correcta.",
        }
      }
      ics = await res.text()
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return {
      error:
        "No pudimos conectar con el calendario. Revisa la dirección e intenta de nuevo.",
    }
  }

  // 2. Validación + clasificación: ¿hay eventos de rol iFlight? loadRosterEvents
  //    descarta lo personal en memoria. Guardamos los eventos para materializar la
  //    disponibilidad sin volver a bajar/parsear el feed; nunca miramos su contenido.
  let eventosRol: RosterEvent[]
  try {
    eventosRol = loadRosterEvents(ics)
  } catch {
    return {
      error:
        "Ese enlace no parece un calendario iCal válido. Copia la dirección secreta en formato iCal.",
    }
  }
  if (eventosRol.length === 0) {
    return {
      error:
        "No encontramos vuelos ni actividades de tripulación en ese calendario. ¿Es la dirección correcta?",
    }
  }

  // 3. Persistir cifrado.
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, buffer_llegada_min")
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberError || !member) {
    return { error: "No encontramos tu hogar. Intenta de nuevo." }
  }

  const nowISO = new Date().toISOString()

  // Materializar AHORA reusando los eventos ya en memoria. Con la sesión del
  // usuario, la RLS de availability_segments acota la escritura a su propio hogar.
  // Un fallo aquí NO rompe el enlace: la conexión igual se guarda y el cron es el
  // respaldo (last_synced_at queda null y se sincroniza en la próxima corrida).
  let sincronizado = false
  try {
    sincronizado = await materializarDisponibilidadVariable(
      supabase,
      member.id,
      eventosRol,
      member.buffer_llegada_min,
      nowISO,
    )
  } catch (e) {
    // Nunca se loguea contenido ni la URL, solo el mensaje del error.
    console.error(
      "[connectCalendar] materialización inmediata falló:",
      e instanceof Error ? e.message : "error desconocido",
    )
  }

  const { error } = await supabase.from("roster_connections").upsert(
    {
      member_id: member.id,
      ical_url_encrypted: encryptSecret(url),
      // Si la materialización inmediata funcionó, sellamos el sync; si no, queda
      // null y el cron la toma en la próxima corrida.
      last_synced_at: sincronizado ? nowISO : null,
      last_fetch_hash: null,
    },
    { onConflict: "member_id" }
  )

  if (error) {
    return { error: "No pudimos guardar la conexión. Intenta de nuevo." }
  }

  // Ya conectó de verdad: si antes había elegido "dejar para más tarde", limpiamos
  // el flag (la conexión ya lo deja configurado por presencia, pero mantenerlo
  // coherente evita sorpresas si más adelante se elimina la conexión).
  await supabase
    .from("members")
    .update({ calendario_omitido: false })
    .eq("id", member.id)

  return { error: null }
}

/**
 * "Dejar para más tarde": entra a la app sin conectar el calendario. Marca
 * members.calendario_omitido para que la guarda del onboarding lo deje pasar
 * (sin esto volvería al paso del calendario en loop). Conectará después desde
 * Ajustes; mientras tanto su disponibilidad se ve "sin información".
 */
export async function omitirCalendario(): Promise<ConnectResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }
  }

  const { error } = await supabase
    .from("members")
    .update({ calendario_omitido: true })
    .eq("user_id", user.id)

  if (error) {
    return { error: "No pudimos guardar. Intenta de nuevo." }
  }

  return { error: null }
}

/**
 * Devuelve una URL https válida, o null. Acepta webcal:// (lo que a veces copia
 * la gente desde Google/Apple) reescribiéndolo a https://.
 */
function normalizarUrl(cruda: string): string | null {
  const texto = cruda.trim()
  if (!texto) return null

  let candidata = texto
  if (candidata.toLowerCase().startsWith("webcal://")) {
    candidata = "https://" + candidata.slice("webcal://".length)
  }

  let parsed: URL
  try {
    parsed = new URL(candidata)
  } catch {
    return null
  }

  if (!parsed.hostname) return null
  if (!esProtocoloPermitido(parsed)) return null

  return parsed.toString()
}

/**
 * Producción: solo https. En desarrollo se permite además http contra
 * localhost/127.0.0.1, para poder probar el flujo con un fixture .ics servido
 * localmente sin exponer datos reales. El guard por NODE_ENV hace imposible que
 * esto habilite http en producción.
 */
function esProtocoloPermitido(parsed: URL): boolean {
  if (parsed.protocol === "https:") return true
  if (
    process.env.NODE_ENV !== "production" &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return true
  }
  return false
}

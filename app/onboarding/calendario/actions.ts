"use server"

import { createClient } from "@/lib/supabase/server"
import { encryptSecret } from "@/lib/crypto/secret-box"
import { loadRosterEvents } from "@/lib/roster"

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
 *   3. Cifra la URL en la app (AES-256-GCM) y hace upsert en roster_connections.
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

  // 1. Fetch de validación (con timeout).
  let ics: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      })
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

  // 2. Validación: ¿hay eventos de rol iFlight? loadRosterEvents descarta lo
  //    personal en memoria; acá solo miramos la cantidad, nunca el contenido.
  let cantidadEventosRol: number
  try {
    cantidadEventosRol = loadRosterEvents(ics).length
  } catch {
    return {
      error:
        "Ese enlace no parece un calendario iCal válido. Copia la dirección secreta en formato iCal.",
    }
  }
  if (cantidadEventosRol === 0) {
    return {
      error:
        "No encontramos vuelos ni actividades de tripulación en ese calendario. ¿Es la dirección correcta?",
    }
  }

  // 3. Persistir cifrado.
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

  const { error } = await supabase.from("roster_connections").upsert(
    {
      member_id: member.id,
      ical_url_encrypted: encryptSecret(url),
      // La clasificación/ingesta real la hace el cron; acá solo dejamos la
      // conexión lista. last_synced_at queda null hasta el primer sync.
      last_synced_at: null,
      last_fetch_hash: null,
    },
    { onConflict: "member_id" }
  )

  if (error) {
    return { error: "No pudimos guardar la conexión. Intenta de nuevo." }
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

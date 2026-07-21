/**
 * Estación (IATA) donde TERMINA el día local, derivada de los vuelos del rol.
 * PURO: sin Next.js ni Supabase. Solo lee eventos ya firmados iFlight (RosterEvent).
 *
 * v1: se etiquetan los VUELOS (destino). Los días fuera terminan con una llegada,
 * así que su estación queda cubierta; los días en casa (sin vuelo) no se etiquetan.
 * Las escalas sin vuelo ese día (layover) quedan sin nota — mejora futura.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL, type RosterEvent } from './types'

/** Destino (IATA) de un evento de vuelo, o null si no aplica. */
export function estacionDestino(e: RosterEvent): string | null {
  if (e.kind !== 'flight') return null
  // "Flight : LA 218 CCP - ANF" -> destino ANF. Tolera espacios variables.
  const m = e.summary.match(/([A-Z]{3})\s*-\s*([A-Z]{3})/)
  return m ? m[2] : null
}

/**
 * Estación donde termina cada día local dentro de [desdeISO, hastaISO] (inclusive):
 * el destino del ÚLTIMO vuelo que aterriza ese día (por hora de fin). Días sin
 * vuelo no aparecen en el mapa.
 */
export function estacionesPorDia(
  events: RosterEvent[],
  desdeISO: string,
  hastaISO: string,
): Map<string, string> {
  const desde = DateTime.fromISO(desdeISO, { zone: TZ_LOCAL }).startOf('day')
  const hasta = DateTime.fromISO(hastaISO, { zone: TZ_LOCAL }).startOf('day')

  // Por fecha, el vuelo con mayor hora de fin (el último que aterriza ese día).
  const mejor = new Map<string, { finMs: number; estacion: string }>()
  for (const e of events) {
    const estacion = estacionDestino(e)
    if (!estacion) continue

    const finLocal = e.endLocal
    const dia = finLocal.startOf('day')
    if (dia < desde || dia > hasta) continue

    const fecha = finLocal.toISODate()!
    const finMs = e.endUtc.toMillis()
    const prev = mejor.get(fecha)
    if (!prev || finMs > prev.finMs) mejor.set(fecha, { finMs, estacion })
  }

  const out = new Map<string, string>()
  for (const [fecha, { estacion }] of mejor) out.set(fecha, estacion)
  return out
}

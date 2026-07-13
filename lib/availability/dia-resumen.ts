/**
 * Resumen por día de una serie de tramos intra-día, para la celda del calendario
 * y el chip semanal del home: una celda chica no puede mostrar 5 tramos, así que
 * colapsa el día a UN estado. PURO: sin Next.js ni Supabase.
 *
 * Regla (decidida con el usuario): PRECEDENCIA CON PISO. Gana el estado de mayor
 * precedencia (fuera > standby_casa > por_confirmar > en_casa) que dure al menos
 * MINUTOS_PISO en el día; si el tiempo de un estado "fuera de casa" es marginal
 * (p. ej. el aterrizaje nocturno: fuera ~2h de madrugada), no alcanza el piso y el
 * día se lee "en casa". Así ambos casos quedan bien: un 9-18 (fuera 9h) se lee
 * FUERA, y el aterrizaje 1am se lee EN CASA — cosa que ni el modelo por-día ni una
 * dominancia por duración pura resolvían (esta última dejaba TODO 9-18 como en_casa).
 *
 * OJO: esto es DISTINTO de estadoDelDiaDesdeSegmentos (lib/roster/segments), que
 * resume por PRECEDENCIA PURA para preservar el golden por-día. Aquel es la verdad
 * de compatibilidad; este es el resumen de un vistazo para la UI.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import {
  normalizarEstado,
  ORDEN_PRECEDENCIA,
  type EstadoDisponibilidad,
} from './estado'

/** Un tramo tal como llega de availability_segments (instantes UTC en ISO). */
export interface TramoVista {
  inicioUtc: string
  finUtc: string
  estado: string
}

/**
 * Piso de duración (minutos) para que un estado defina el resumen del día. Debajo
 * de esto, un estado "fuera de casa" se considera marginal (aterrizaje nocturno).
 * Configurable; 3 horas por defecto.
 */
export const MINUTOS_PISO = 180

/**
 * Estado que resume el día local `diaISO` (yyyy-mm-dd) entre los tramos dados:
 * el de mayor precedencia que supere el piso de duración. null si ningún tramo
 * (con estado conocido) solapa el día.
 */
export function resumirDia(tramos: TramoVista[], diaISO: string): EstadoDisponibilidad | null {
  const inicioDia = DateTime.fromISO(diaISO, { zone: TZ_LOCAL }).startOf('day')
  const a = inicioDia.toMillis()
  const b = inicioDia.plus({ days: 1 }).toMillis()

  const duracion = new Map<EstadoDisponibilidad, number>()
  for (const t of tramos) {
    const estado = normalizarEstado(t.estado)
    if (!estado) continue
    const i = Math.max(a, DateTime.fromISO(t.inicioUtc).toMillis())
    const f = Math.min(b, DateTime.fromISO(t.finUtc).toMillis())
    if (f <= i) continue // no solapa el día
    duracion.set(estado, (duracion.get(estado) ?? 0) + (f - i))
  }
  if (duracion.size === 0) return null

  // 1. El estado de mayor precedencia que supere el piso.
  const pisoMs = MINUTOS_PISO * 60_000
  for (const estado of ORDEN_PRECEDENCIA) {
    const ms = duracion.get(estado)
    if (ms != null && ms >= pisoMs) return estado
  }

  // 2. Ninguno alcanza el piso (día con datos parciales): dominante por duración,
  //    empate por precedencia (orden estricto `>`).
  let mejor: EstadoDisponibilidad | null = null
  let mejorMs = 0
  for (const estado of ORDEN_PRECEDENCIA) {
    const ms = duracion.get(estado)
    if (ms != null && ms > mejorMs) {
      mejorMs = ms
      mejor = estado
    }
  }
  return mejor
}

/** Estado y fin del tramo que cubre el instante `nowISO`; null si ninguno lo cubre. */
export function estadoEnInstante(
  tramos: TramoVista[],
  nowISO: string,
): { estado: EstadoDisponibilidad; finUtc: string } | null {
  const now = DateTime.fromISO(nowISO).toMillis()
  for (const t of tramos) {
    const i = DateTime.fromISO(t.inicioUtc).toMillis()
    const f = DateTime.fromISO(t.finUtc).toMillis()
    if (i <= now && now < f) {
      const estado = normalizarEstado(t.estado)
      return estado ? { estado, finUtc: t.finUtc } : null
    }
  }
  return null
}

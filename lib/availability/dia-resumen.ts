/**
 * Resumen por día de una serie de tramos intra-día, para la celda del calendario
 * y el chip semanal del home: una celda chica no puede mostrar 5 tramos, así que
 * colapsa el día a UN estado. PURO: sin Next.js ni Supabase.
 *
 * ┌─ REGLA DEL EJE CASA ↔ FUERA (tres niveles) ────────────────────────────────┐
 * │ Decidida con el usuario (2026-07-20). Colapsar el día a UN estado pierde    │
 * │ información: los días de tripulación son casi siempre MIXTOS (un pedazo     │
 * │ fuera, un pedazo en casa). Un vuelo nocturno que cruza la medianoche es el  │
 * │ caso claro: sale la noche del día D-1 (2h fuera) y aterriza 05:45 del día D │
 * │ (5.75h fuera) — con un solo estado, D-1 se leía "en casa" (ocultaba que se  │
 * │ fue) y D se leía "fuera" (cuando estuvo en casa 18h). Ambos mentían.        │
 * │                                                                             │
 * │ Con `fuera` = minutos fuera en el día y `casa` = minutos no-fuera:          │
 * │   • fuera < MINUTOS_RUIDO (45)            → NO es día fuera (roce marginal). │
 * │   • fuera ≥ 45 y (casa < 45 ó            → FUERA sólido (fuera casi todo    │
 * │     fuera ≥ MINUTOS_JORNADA_COMPLETA 480)   el día, o una jornada completa). │
 * │   • resto (fuera y casa ambos notables)  → FUERA PARCIAL (día mixto).       │
 * │ Así un 9-18 (fuera ~10h ≥ 8h) queda FUERA limpio, y el vuelo nocturno queda │
 * │ PARCIAL en sus dos días. Los umbrales son las perillas; ver constantes.     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Cuando el fuera es despreciable (< 45 min), el titular sale de los estados
 * "en casa-ish" (standby / blanco / en casa) por PRECEDENCIA CON PISO (MINUTOS_PISO):
 * gana el de mayor precedencia que dure ≥ el piso; si ninguno, el más largo.
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

/** Resumen del día para la celda: el estado titular + si el día es parcial. */
export interface ResumenDia {
  estado: EstadoDisponibilidad
  /**
   * true si el día es MIXTO en el eje casa↔fuera: hubo fuera notable Y casa
   * notable, sin que el fuera cubra una jornada completa. Solo aplica cuando
   * `estado` es 'fuera' (en los estados "en casa-ish" siempre es false).
   */
  parcial: boolean
}

/**
 * Debajo de esto, el tiempo "fuera" de un día se considera RUIDO (un aterrizaje que
 * apenas roza la medianoche): no convierte el día en "fuera". También es el mínimo
 * de "casa" para que un día cuente como parcial en vez de fuera-sólido.
 */
export const MINUTOS_RUIDO = 45

/**
 * A partir de esto, el "fuera" del día se lee como una JORNADA COMPLETA fuera →
 * FUERA sólido, aunque quede tiempo en casa (mañana/noche). Mantiene un 9-18 como
 * "fuera" limpio en vez de "parcial". 8 horas por defecto.
 */
export const MINUTOS_JORNADA_COMPLETA = 480

/**
 * Piso de duración (minutos) para que un estado "en casa-ish" (standby/blanco/en
 * casa) defina el titular del día cuando el fuera es despreciable. 3 horas.
 */
export const MINUTOS_PISO = 180

/**
 * Resume el día local `diaISO` (yyyy-mm-dd) entre los tramos dados. null si ningún
 * tramo (con estado conocido) solapa el día. Ver la regla en la cabecera.
 */
export function resumirDia(tramos: TramoVista[], diaISO: string): ResumenDia | null {
  const inicioDia = DateTime.fromISO(diaISO, { zone: TZ_LOCAL }).startOf('day')
  const a = inicioDia.toMillis()
  const b = inicioDia.plus({ days: 1 }).toMillis()

  const duracion = new Map<EstadoDisponibilidad, number>()
  let totalMs = 0
  for (const t of tramos) {
    const estado = normalizarEstado(t.estado)
    if (!estado) continue
    const i = Math.max(a, DateTime.fromISO(t.inicioUtc).toMillis())
    const f = Math.min(b, DateTime.fromISO(t.finUtc).toMillis())
    if (f <= i) continue // no solapa el día
    const ms = f - i
    duracion.set(estado, (duracion.get(estado) ?? 0) + ms)
    totalMs += ms
  }
  if (duracion.size === 0) return null

  const ruidoMs = MINUTOS_RUIDO * 60_000
  const fueraMs = duracion.get('fuera') ?? 0

  // Eje casa↔fuera: si el fuera pasa el ruido, el día es FUERA (sólido o parcial).
  if (fueraMs >= ruidoMs) {
    const casaMs = totalMs - fueraMs
    const solido = casaMs < ruidoMs || fueraMs >= MINUTOS_JORNADA_COMPLETA * 60_000
    return { estado: 'fuera', parcial: !solido }
  }

  // Fuera despreciable: el titular sale de los estados en-casa-ish por precedencia
  // con piso; si ninguno lo alcanza, el más largo. 'fuera' se excluye (ya se
  // resolvió arriba: es marginal). 'parcial' no aplica a estos estados.
  const pisoMs = MINUTOS_PISO * 60_000
  for (const estado of ORDEN_PRECEDENCIA) {
    if (estado === 'fuera') continue
    const ms = duracion.get(estado)
    if (ms != null && ms >= pisoMs) return { estado, parcial: false }
  }
  let mejor: EstadoDisponibilidad | null = null
  let mejorMs = 0
  for (const estado of ORDEN_PRECEDENCIA) {
    if (estado === 'fuera') continue
    const ms = duracion.get(estado)
    if (ms != null && ms > mejorMs) {
      mejorMs = ms
      mejor = estado
    }
  }
  return mejor ? { estado: mejor, parcial: false } : null
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

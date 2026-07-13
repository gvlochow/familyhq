/**
 * Re-arquitectura de disponibilidad: de un estado por día a TRAMOS intra-día.
 *
 * En vez de colapsar cada día a un único estado (lossy: un crew que aterriza a la
 * 1am queda "fuera" el día entero pese a estar 22 horas en casa), este módulo
 * construye una línea de tiempo continua de tramos `(inicio, fin, estado)` donde
 * el estado es constante dentro de cada tramo y cambia solo en los bordes reales
 * del rol (report/debrief + buffer, ventanas de standby, actividades).
 *
 * REGLA DE ORO (ver PROJECT_LOG / memoria intra-day-availability-model): la lógica
 * de DETECCIÓN no cambia, solo la granularidad. El estado por-día derivado desde
 * los tramos (estadoDelDiaDesdeSegmentos) DEBE seguir idéntico al de estadoPorDia
 * y al golden de julio validado por Pablo. Si el golden se rompe, es un bug.
 *
 * Módulo de dominio puro: sin Next.js ni Supabase. Horas en UTC (como el resto de
 * lib/roster); la conversión a America/Santiago (IANA, con DST) se hace al derivar
 * el día y al presentar.
 */
import { DateTime } from 'luxon'
import { buildDutyBlocks, type Dia } from './classify'
import {
  ACTIVITY_MAP,
  DEFAULT_BUFFER_LLEGADA_MIN,
  Estado,
  RosterEvent,
  TZ_LOCAL,
} from './types'
import type { EstadoDia } from './classify'

/**
 * Precedencia cuando varias fuentes cubren el mismo instante. Mayor gana.
 * Espeja la prioridad del clasificador por-día (classify.ts): un bloque de trabajo
 * o un ASB (aeropuerto) ganan sobre standby en casa, que gana sobre "por confirmar",
 * que gana sobre la base "en casa". Es la MISMA regla, resuelta por instante en vez
 * de por día.
 */
const PRECEDENCIA: Record<Estado, number> = {
  [Estado.EN_CASA]: 0,
  [Estado.POR_CONFIRMAR]: 1,
  [Estado.STANDBY_CASA]: 2,
  [Estado.FUERA]: 3,
}

/** Un tramo intra-día: intervalo [inicioUtc, finUtc) con un estado constante. */
export interface Segmento {
  /** Inicio del tramo (instante, zona UTC). Inclusivo. */
  inicioUtc: DateTime
  /** Fin del tramo (instante, zona UTC). Exclusivo. */
  finUtc: DateTime
  estado: Estado
}

/** Intervalo con estado en epoch-ms, fuente intermedia antes de resolver precedencia. */
interface IntervaloEstado {
  inicioMs: number
  finMs: number
  estado: Estado
}

/**
 * Construye la línea de tiempo de tramos para una ventana [desdeISO, hastaISO]
 * (fechas locales, ambos días inclusive). La base es EN_CASA; encima se superponen,
 * por precedencia, los bloques de trabajo (FUERA, con el buffer de llegada ya
 * aplicado al final del bloque) y las actividades del rol (DO/HSB/ASB/B).
 *
 * La detección de bloques usa TODOS los eventos (un bloque que cruza el borde de la
 * ventana se detecta igual); solo la SALIDA se recorta a la ventana. Los tramos
 * resultantes son contiguos, no se solapan y cubren toda la ventana.
 */
export function construirSegmentos(
  events: RosterEvent[],
  desdeISO: string,
  hastaISO: string,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): Segmento[] {
  const ventanaInicio = DateTime.fromISO(desdeISO, { zone: TZ_LOCAL }).startOf('day')
  // Fin exclusivo: medianoche local del día siguiente al último día de la ventana.
  const ventanaFin = DateTime.fromISO(hastaISO, { zone: TZ_LOCAL })
    .startOf('day')
    .plus({ days: 1 })
  const winStart = ventanaInicio.toMillis()
  const winEnd = ventanaFin.toMillis()
  if (winEnd <= winStart) return []

  const intervalos: IntervaloEstado[] = []

  // Bloques de trabajo -> FUERA. El buffer de llegada ya está aplicado al fin del
  // bloque (buildDutyBlocks): el tramo FUERA termina en aterrizaje/debrief + buffer,
  // y ahí retoma EN_CASA. Ese es el arreglo del "aterrizaje a la 1am".
  for (const b of buildDutyBlocks(events, bufferLlegadaMin)) {
    intervalos.push({
      inicioMs: b.startUtc.toMillis(),
      finMs: b.endUtc.toMillis(),
      estado: Estado.FUERA,
    })
  }

  // Actividades (DO/DH/HSB/ASB/B) -> su estado mapeado, en su ventana horaria real.
  // Un HSB de 08:00 a 20:00 deja el resto del día EN_CASA, en vez de teñir el día entero.
  for (const e of events) {
    if (e.kind !== 'activity') continue
    intervalos.push({
      inicioMs: e.startUtc.toMillis(),
      finMs: e.endUtc.toMillis(),
      estado: ACTIVITY_MAP[e.code] ?? Estado.EN_CASA,
    })
  }

  // Fronteras (coordinate compression): bordes de intervalos dentro de la ventana,
  // más los extremos de la ventana.
  const fronteras = new Set<number>([winStart, winEnd])
  for (const iv of intervalos) {
    if (iv.inicioMs > winStart && iv.inicioMs < winEnd) fronteras.add(iv.inicioMs)
    if (iv.finMs > winStart && iv.finMs < winEnd) fronteras.add(iv.finMs)
  }
  const cortes = [...fronteras].sort((a, b) => a - b)

  // Estado de cada intervalo elemental por precedencia; EN_CASA de base.
  const elementales: Segmento[] = []
  for (let i = 0; i < cortes.length - 1; i++) {
    const a = cortes[i]
    const b = cortes[i + 1]
    let estado = Estado.EN_CASA
    let prec = PRECEDENCIA[Estado.EN_CASA]
    for (const iv of intervalos) {
      if (iv.inicioMs <= a && iv.finMs >= b) {
        const p = PRECEDENCIA[iv.estado]
        if (p > prec) {
          prec = p
          estado = iv.estado
        }
      }
    }
    elementales.push({
      inicioUtc: DateTime.fromMillis(a, { zone: 'utc' }),
      finUtc: DateTime.fromMillis(b, { zone: 'utc' }),
      estado,
    })
  }

  return fusionar(elementales)
}

/** Fusiona tramos contiguos del mismo estado en uno solo. */
function fusionar(segs: Segmento[]): Segmento[] {
  const out: Segmento[] = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (
      last &&
      last.estado === s.estado &&
      last.finUtc.toMillis() === s.inicioUtc.toMillis()
    ) {
      last.finUtc = s.finUtc
    } else {
      out.push({ ...s })
    }
  }
  return out
}

/**
 * Deriva el estado por-día (compatibilidad con el modelo anterior y con el golden):
 * el estado de MAYOR precedencia entre los tramos que solapan el día local.
 *
 * Es equivalente a estadoPorDia por construcción: FUERA (bloque o ASB) que toca el
 * día gana como antes; si no, gana la actividad de mayor prioridad del día; si no,
 * EN_CASA. La única diferencia con el modelo viejo es que además conservamos los
 * tramos, que el día colapsa pero la UI intra-día aprovechará.
 */
export function estadoDelDiaDesdeSegmentos(segmentos: Segmento[], dia: Dia): Estado {
  const dayStart = DateTime.fromObject(
    { year: dia.year, month: dia.month, day: dia.day },
    { zone: TZ_LOCAL },
  )
  const a = dayStart.toMillis()
  const b = dayStart.plus({ days: 1 }).toMillis()

  let estado = Estado.EN_CASA
  let prec = PRECEDENCIA[Estado.EN_CASA]
  for (const s of segmentos) {
    if (s.inicioUtc.toMillis() < b && s.finUtc.toMillis() > a) {
      const p = PRECEDENCIA[s.estado]
      if (p > prec) {
        prec = p
        estado = s.estado
      }
    }
  }
  return estado
}

/**
 * Estado por-día de cada día de un mes, derivado DESDE los tramos. Espejo de
 * estadosDelMes (classify.ts) pero pasando por el modelo de segmentos: es el puente
 * que prueba, contra el golden de julio, que la re-arquitectura no cambió la verdad.
 */
export function estadosDelMesDesdeSegmentos(
  events: RosterEvent[],
  year: number,
  month: number,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): EstadoDia[] {
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: TZ_LOCAL })
  const days = first.daysInMonth ?? 0
  const desde = first.toISODate()!
  const hasta = first.set({ day: days }).toISODate()!

  const segmentos = construirSegmentos(events, desde, hasta, bufferLlegadaMin)

  const out: EstadoDia[] = []
  for (let day = 1; day <= days; day++) {
    out.push({
      fecha: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      estado: estadoDelDiaDesdeSegmentos(segmentos, { year, month, day }),
    })
  }
  return out
}

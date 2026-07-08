/**
 * Detección de rotaciones multi-día y clasificación del estado por día.
 * Porta build_duty_blocks / estado_por_dia y agrega estadosDelMes (scoping mensual).
 */
import { DateTime } from 'luxon'
import {
  ACTIVITY_MAP,
  DEFAULT_BUFFER_LLEGADA_MIN,
  Estado,
  RosterEvent,
  TZ_LOCAL,
} from './types'

/** Descanso mínimo (horas) que separa dos rotaciones distintas. */
const GAP_HOURS = 8

/** Un día calendario local, para consultar su estado. */
export interface Dia {
  year: number
  month: number
  day: number
}

/** Bloque de trabajo continuo (una rotación): del primer report al último debrief. */
export class DutyBlock {
  constructor(
    public startUtc: DateTime,
    public endUtc: DateTime,
    public events: RosterEvent[],
  ) {}

  get startLocal(): DateTime {
    return this.startUtc.setZone(TZ_LOCAL)
  }

  get endLocal(): DateTime {
    return this.endUtc.setZone(TZ_LOCAL)
  }
}

/**
 * Agrupa vuelos/reports contiguos en bloques de trabajo (rotaciones).
 *
 * Regla: dos eventos de vuelo/report que se solapan o están a < 8h se consideran
 * la misma rotación. El buffer de llegada se aplica UNA vez, al final del bloque
 * completo (al último evento), no a cada tramo.
 *
 * Nota: el buffer de SALIDA no se aplica en la clasificación actual (igual que el
 * harness original); se mantiene como default configurable en types.ts.
 */
export function buildDutyBlocks(
  events: RosterEvent[],
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): DutyBlock[] {
  const duty = events
    .filter((e) => e.kind === 'flight' || e.kind === 'report')
    .sort((a, b) => a.startUtc.toMillis() - b.startUtc.toMillis())

  const blocks: DutyBlock[] = []
  if (duty.length === 0) return blocks

  let cur = new DutyBlock(duty[0].startUtc, duty[0].endUtc, [duty[0]])
  for (const e of duty.slice(1)) {
    const gapHours = e.startUtc.diff(cur.endUtc, 'hours').hours
    if (gapHours <= GAP_HOURS) {
      cur.endUtc = DateTime.max(cur.endUtc, e.endUtc)
      cur.events.push(e)
    } else {
      blocks.push(cur)
      cur = new DutyBlock(e.startUtc, e.endUtc, [e])
    }
  }
  blocks.push(cur)

  // Buffer de llegada al final de cada bloque completo.
  for (const b of blocks) {
    b.endUtc = b.endUtc.plus({ minutes: bufferLlegadaMin })
  }
  return blocks
}

/** Estado familiar para un día calendario (en hora local de Santiago). */
export function estadoPorDia(
  events: RosterEvent[],
  dia: Dia,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): Estado {
  const blocks = buildDutyBlocks(events, bufferLlegadaMin)

  const dayStart = DateTime.fromObject(
    { year: dia.year, month: dia.month, day: dia.day },
    { zone: TZ_LOCAL },
  )
  const dayEnd = dayStart.plus({ days: 1 })
  const startMs = dayStart.toMillis()
  const endMs = dayEnd.toMillis()

  // 1. Si el día cae dentro de un bloque de trabajo -> FUERA (incluye días intermedios).
  for (const b of blocks) {
    if (b.startUtc.toMillis() < endMs && b.endUtc.toMillis() > startMs) {
      return Estado.FUERA
    }
  }

  // 2. Si no, mirar la actividad asignada a ese día (DO/DH/HSB/ASB/B).
  const estadosDia: Estado[] = []
  for (const e of events) {
    if (e.kind !== 'activity') continue
    if (e.startUtc.toMillis() < endMs && e.endUtc.toMillis() > startMs) {
      estadosDia.push(ACTIVITY_MAP[e.code] ?? Estado.EN_CASA)
    }
  }

  if (estadosDia.length > 0) {
    // Prioridad: FUERA > STANDBY_CASA > POR_CONFIRMAR > EN_CASA
    for (const prioridad of [
      Estado.FUERA,
      Estado.STANDBY_CASA,
      Estado.POR_CONFIRMAR,
      Estado.EN_CASA,
    ]) {
      if (estadosDia.includes(prioridad)) return prioridad
    }
  }

  // 3. Sin info -> por defecto en casa (día libre implícito).
  return Estado.EN_CASA
}

/** Estado de un día con su fecha ISO (yyyy-mm-dd). */
export interface EstadoDia {
  fecha: string
  estado: Estado
}

/**
 * Estado de cada día de un mes dado. Acota la SALIDA al mes pedido (el feed
 * arrastra meses anteriores), pero las rotaciones se calculan con todos los
 * eventos para que un bloque que cruza el borde del mes se detecte igual.
 */
export function estadosDelMes(
  events: RosterEvent[],
  year: number,
  month: number,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): EstadoDia[] {
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: TZ_LOCAL })
  const days = first.daysInMonth ?? 0

  const out: EstadoDia[] = []
  for (let day = 1; day <= days; day++) {
    out.push({
      fecha: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      estado: estadoPorDia(events, { year, month, day }, bufferLlegadaMin),
    })
  }
  return out
}

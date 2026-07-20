/**
 * Detección de rotaciones multi-día y clasificación del estado por día.
 * Porta build_duty_blocks / estado_por_dia y agrega estadosDelMes (scoping mensual).
 */
import { DateTime } from 'luxon'
import {
  ACTIVITY_MAP,
  DEFAULT_BUFFER_LLEGADA_MIN,
  DEFAULT_BUFFER_SALIDA_MIN,
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
 * la misma rotación. Los buffers de traslado se aplican UNA vez al bloque completo:
 * el de SALIDA al inicio (viaje a trabajo: sale de casa antes del report) y el de
 * LLEGADA al final (viaje desde trabajo: llega a casa después del último debrief).
 * Ambos extienden la ventana FUERA. Verificado que no altera el golden de julio (el
 * piso de resumen por-día absorbe los corrimientos marginales).
 */
export function buildDutyBlocks(
  events: RosterEvent[],
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
  bufferSalidaMin: number = DEFAULT_BUFFER_SALIDA_MIN,
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

  // Buffers de traslado al bloque completo: salida al inicio, llegada al final.
  for (const b of blocks) {
    b.startUtc = b.startUtc.minus({ minutes: bufferSalidaMin })
    b.endUtc = b.endUtc.plus({ minutes: bufferLlegadaMin })
  }
  return blocks
}

/**
 * Estado de un día junto con los eventos de rol que lo determinaron.
 *
 * `eventos` es la evidencia subyacente de por qué el día quedó en ese estado:
 * los eventos del bloque de trabajo que lo cubre, o las actividades asignadas a
 * ese día. La ingesta lo usa para derivar un hash por día (source_event_hash),
 * base de la regla de override: si esa evidencia cambia, el override se descarta.
 * Un día libre implícito (EN_CASA por defecto) no tiene evidencia: `eventos` vacío.
 */
export interface ClasificacionDia {
  estado: Estado
  eventos: RosterEvent[]
}

/**
 * Clasifica un día devolviendo estado + los eventos que lo determinaron.
 * `estadoPorDia` es el atajo que solo mira el estado (lo usa el golden test).
 */
export function clasificarDia(
  events: RosterEvent[],
  dia: Dia,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): ClasificacionDia {
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
      return { estado: Estado.FUERA, eventos: b.events }
    }
  }

  // 2. Si no, mirar la actividad asignada a ese día (DO/DH/HSB/ASB/B).
  const actividadesDia: RosterEvent[] = []
  const estadosDia: Estado[] = []
  for (const e of events) {
    if (e.kind !== 'activity') continue
    if (e.startUtc.toMillis() < endMs && e.endUtc.toMillis() > startMs) {
      actividadesDia.push(e)
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
      if (estadosDia.includes(prioridad)) {
        return { estado: prioridad, eventos: actividadesDia }
      }
    }
  }

  // 3. Sin info -> por defecto en casa (día libre implícito, sin evidencia).
  return { estado: Estado.EN_CASA, eventos: [] }
}

/** Estado familiar para un día calendario (en hora local de Santiago). */
export function estadoPorDia(
  events: RosterEvent[],
  dia: Dia,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): Estado {
  return clasificarDia(events, dia, bufferLlegadaMin).estado
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

/**
 * Derivación del horario FIJO a tramos intra-día (members con tipo_horario='fijo').
 *
 * El modelo por-día era igual de lossy para el fijo que para el variable: un 9-18
 * quedaba "fuera" el día entero, borrando que la persona está en casa por la
 * mañana, por la tarde y —si va a almorzar— al mediodía. Acá se expande el horario
 * semanal (fixed_schedules) a la misma estructura de Segmento que usa el clasificador
 * de rol, para que ambos segmentos alimenten availability_segments por igual.
 *
 * Módulo puro: sin Next.js ni Supabase. Las horas de fixed_schedules son de reloj
 * local ("HH:MM[:SS]", sin fecha); se anclan a cada día calendario en
 * America/Santiago (IANA, con DST) y se convierten a UTC. Por eso importa la zona:
 * un 09:00 local es un instante UTC distinto en invierno que en verano.
 */
import { DateTime } from 'luxon'
import { Estado, TZ_LOCAL } from '../roster/types'
import { fusionar, type Segmento } from '../roster/segments'

/**
 * Un día de la semana del horario fijo, con la forma en que vive en fixed_schedules.
 * `horaInicio`/`horaFin` null = ese día no se trabaja. El almuerzo solo aplica a
 * días de trabajo con `almuerzaEnCasa=true` (mismas reglas que validarBloques).
 */
export interface FilaHorarioFijo {
  /** Día ISO 8601: 1=lunes ... 7=domingo. */
  diaSemana: number
  horaInicio: string | null
  horaFin: string | null
  almuerzaEnCasa: boolean
  horaAlmuerzoInicio: string | null
  horaAlmuerzoFin: string | null
}

/**
 * Expande el horario semanal a tramos para la ventana [desdeISO, hastaISO]
 * (fechas locales, ambos días inclusive). Tramos contiguos, sin solape, que cubren
 * toda la ventana; EN_CASA por defecto y FUERA en la jornada, con la ventana de
 * almuerzo en casa recortada dentro de la jornada.
 */
export function construirSegmentosFijo(
  filas: FilaHorarioFijo[],
  desdeISO: string,
  hastaISO: string,
): Segmento[] {
  const porDia = new Map<number, FilaHorarioFijo>()
  for (const f of filas) porDia.set(f.diaSemana, f)

  const desde = DateTime.fromISO(desdeISO, { zone: TZ_LOCAL }).startOf('day')
  const hasta = DateTime.fromISO(hastaISO, { zone: TZ_LOCAL }).startOf('day')
  if (hasta < desde) return []

  const segs: Segmento[] = []
  for (let dia = desde; dia <= hasta; dia = dia.plus({ days: 1 })) {
    segmentosDelDia(dia, porDia.get(dia.weekday), segs)
  }

  return fusionar(segs)
}

/**
 * Agrega a `acc` los tramos de un solo día local. Un día libre (sin fila o sin
 * horas) es EN_CASA completo; un día de trabajo intercala FUERA en la jornada y,
 * si corresponde, EN_CASA en el almuerzo.
 */
function segmentosDelDia(
  dia: DateTime,
  fila: FilaHorarioFijo | undefined,
  acc: Segmento[],
): void {
  const inicioDia = dia // ya es startOf('day') en TZ_LOCAL
  const finDia = dia.plus({ days: 1 })

  if (!fila || !fila.horaInicio || !fila.horaFin) {
    empujar(acc, inicioDia, finDia, Estado.EN_CASA)
    return
  }

  const jornadaInicio = anclar(dia, fila.horaInicio)
  const jornadaFin = anclar(dia, fila.horaFin)

  // Mañana en casa antes de entrar a trabajar.
  empujar(acc, inicioDia, jornadaInicio, Estado.EN_CASA)

  const almuerzo =
    fila.almuerzaEnCasa && fila.horaAlmuerzoInicio && fila.horaAlmuerzoFin
      ? { inicio: anclar(dia, fila.horaAlmuerzoInicio), fin: anclar(dia, fila.horaAlmuerzoFin) }
      : null

  if (almuerzo) {
    // Jornada partida por la ida a casa a almorzar: fuera / en_casa / fuera.
    empujar(acc, jornadaInicio, almuerzo.inicio, Estado.FUERA)
    empujar(acc, almuerzo.inicio, almuerzo.fin, Estado.EN_CASA)
    empujar(acc, almuerzo.fin, jornadaFin, Estado.FUERA)
  } else {
    empujar(acc, jornadaInicio, jornadaFin, Estado.FUERA)
  }

  // Tarde/noche en casa tras salir del trabajo.
  empujar(acc, jornadaFin, finDia, Estado.EN_CASA)
}

/** Ancla una hora de reloj "HH:MM[:SS]" al día local dado y devuelve el instante UTC. */
function anclar(dia: DateTime, hora: string): DateTime {
  const [h, m] = hora.split(':').map(Number)
  return dia.set({ hour: h, minute: m, second: 0, millisecond: 0 }).toUTC()
}

/** Empuja un tramo [inicio, fin) si tiene duración positiva (evita tramos vacíos). */
function empujar(acc: Segmento[], inicioUtc: DateTime, finUtc: DateTime, estado: Estado): void {
  if (finUtc.toMillis() <= inicioUtc.toMillis()) return
  acc.push({ inicioUtc: inicioUtc.toUTC(), finUtc: finUtc.toUTC(), estado })
}

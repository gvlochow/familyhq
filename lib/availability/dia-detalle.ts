/**
 * Detalle intra-día de un día para todos los integrantes: el desglose que aparece
 * al TOCAR un día del calendario. Acá es donde se ve el intra-día completo que el
 * modelo por-día borraba ("Pablo: en casa hasta 09:00, fuera 09:00–18:00, en casa
 * desde 18:00"). PURO: sin Next.js ni Supabase.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import {
  normalizarEstado,
  ORDEN_PRECEDENCIA,
  type EstadoDisponibilidad,
} from './estado'
import { resumirDia } from './dia-resumen'
import type { MiembroCalendario } from './mes-familia'

/** Un tramo del día ya recortado a [00:00, 24:00) local, para dibujar la barra. */
export interface SegmentoDia {
  estado: EstadoDisponibilidad | null
  /** Fracción del día (0..1) donde empieza/termina, para el ancho de la barra. */
  inicioFrac: number
  finFrac: number
  /** Horas locales "HH:MM" (el fin exacto de medianoche se muestra "24:00"). */
  inicioHHMM: string
  finHHMM: string
}

export interface MiembroDetalle {
  id: string
  inicial: string
  nombre: string
  /** Resumen del día (misma regla que la celda): para el orden y el pill. */
  resumen: EstadoDisponibilidad | null
  segmentos: SegmentoDia[]
}

/**
 * Desglose intra-día de `fechaISO` (yyyy-mm-dd local) por integrante, ordenado
 * "excepciones primero" (quién está más fuera, arriba). Cada integrante trae sus
 * tramos recortados al día; sin datos -> un único tramo "sin información".
 */
export function detalleDelDia(
  miembros: MiembroCalendario[],
  fechaISO: string,
): MiembroDetalle[] {
  const dayStart = DateTime.fromISO(fechaISO, { zone: TZ_LOCAL }).startOf('day')
  const dayEnd = dayStart.plus({ days: 1 })
  const a = dayStart.toMillis()
  const b = dayEnd.toMillis()
  const total = b - a

  const seg = (estado: EstadoDisponibilidad | null, i: number, f: number): SegmentoDia => ({
    estado,
    inicioFrac: (i - a) / total,
    finFrac: (f - a) / total,
    inicioHHMM: DateTime.fromMillis(i, { zone: 'utc' }).setZone(TZ_LOCAL).toFormat('HH:mm'),
    finHHMM: f === b ? '24:00' : DateTime.fromMillis(f, { zone: 'utc' }).setZone(TZ_LOCAL).toFormat('HH:mm'),
  })

  const detalle = miembros.map((m): MiembroDetalle => {
    const clipped = m.tramos
      .map((t) => ({
        i: Math.max(a, DateTime.fromISO(t.inicioUtc).toMillis()),
        f: Math.min(b, DateTime.fromISO(t.finUtc).toMillis()),
        estado: normalizarEstado(t.estado),
      }))
      .filter((s) => s.f > s.i)
      .sort((x, y) => x.i - y.i)

    const segmentos =
      clipped.length > 0 ? clipped.map((s) => seg(s.estado, s.i, s.f)) : [seg(null, a, b)]

    return {
      id: m.id,
      inicial: m.inicial,
      nombre: m.nombre,
      resumen: resumirDia(m.tramos, fechaISO),
      segmentos,
    }
  })

  const rank = (e: EstadoDisponibilidad | null) =>
    e ? ORDEN_PRECEDENCIA.indexOf(e) : ORDEN_PRECEDENCIA.length
  return detalle.sort(
    (x, y) => rank(x.resumen) - rank(y.resumen) || x.nombre.localeCompare(y.nombre, 'es'),
  )
}

/** Tramos que NO son "en casa", como frase corta: "Fuera 09:00–18:00 · ...". */
export function fraseFuera(segmentos: SegmentoDia[]): string {
  const etiqueta: Record<EstadoDisponibilidad, string> = {
    fuera: 'Fuera',
    standby_casa: 'Standby',
    por_confirmar: 'Por confirmar',
    en_casa: 'En casa',
  }
  const fuera = segmentos.filter((s) => s.estado && s.estado !== 'en_casa')
  if (segmentos.every((s) => s.estado === null)) return 'Sin información'
  if (fuera.length === 0) return 'En casa todo el día'
  return fuera
    .map((s) => `${etiqueta[s.estado as EstadoDisponibilidad]} ${s.inicioHHMM}–${s.finHHMM}`)
    .join(' · ')
}

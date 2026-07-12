/**
 * Ingesta: del feed .ics ya cargado a las filas de availability_days que el cron
 * persiste. Capa PURA (sin fetch, sin Supabase, sin descifrado): recibe el .ics
 * como texto y devuelve filas listas para upsert. Así se testea sin red ni DB.
 *
 * El I/O (descifrar la URL, fetch, escribir en la base) vive en el route handler
 * del cron (app/api/cron/roster). Acá solo hay dominio.
 */
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import { clasificarDia } from './classify'
import { DEFAULT_BUFFER_LLEGADA_MIN, Estado, RosterEvent, TZ_LOCAL } from './types'

/**
 * Cuántos meses hacia adelante materializa el cron, además del mes en curso.
 * Ventana = mes actual + MESES_ADELANTE (por defecto 4 meses de calendario).
 * El feed del rol rara vez publica más allá; ampliar si en la práctica trae más.
 */
export const MESES_ADELANTE = 3

/** Estado clasificado de un día, con el hash de su evidencia subyacente. */
export interface FilaDisponibilidad {
  /** yyyy-mm-dd en hora local de Santiago. */
  fecha: string
  estado: Estado
  /** Hash de los eventos que determinaron el día; null si es día libre implícito. */
  sourceEventHash: string | null
}

/** Fila final lista para availability_days, tras resolver overrides. */
export interface FilaAvailability {
  fecha: string
  estado: string
  source: 'clasificado' | 'override'
  sourceEventHash: string | null
}

/** Override manual tal como vive en availability_overrides (subconjunto relevante). */
export interface OverrideDia {
  fecha: string
  estado: string
  sourceEventHashAtOverride: string | null
}

/**
 * Ventana de clasificación por defecto a partir de un "hoy" local: desde el
 * primer día del mes en curso hasta el último día de +MESES_ADELANTE meses.
 * `hoyISO` (yyyy-mm-dd) es inyectable para tests deterministas; sin él usa now().
 */
export function ventanaPorDefecto(hoyISO?: string): { desde: string; hasta: string } {
  const hoy = hoyISO
    ? DateTime.fromISO(hoyISO, { zone: TZ_LOCAL })
    : DateTime.now().setZone(TZ_LOCAL)
  const desde = hoy.startOf('month')
  const hasta = desde.plus({ months: MESES_ADELANTE }).endOf('month')
  return { desde: desde.toISODate()!, hasta: hasta.toISODate()! }
}

/**
 * Hash estable de la evidencia de un día. Usa las horas CRUDAS del evento (no las
 * ajustadas por buffer), así que para la mayoría de los días cambiar el buffer no
 * altera el hash. Día sin evidencia -> null.
 *
 * Salvedades conocidas (revisar al construir la UI de corrección manual, ver
 * PROJECT_LOG): (1) un día FUERA dentro de una rotación multi-día recibe el hash
 * de TODOS los eventos del bloque, así que un cambio en cualquier tramo invalida
 * los overrides de los demás días del bloque; (2) en los días borde de un bloque,
 * el buffer sí decide si el día cae dentro, y ahí puede cambiar la evidencia.
 */
export function hashEventos(eventos: RosterEvent[]): string | null {
  if (eventos.length === 0) return null
  const firmas = eventos
    .map((e) => `${e.uid}|${e.startUtc.toISO()}|${e.endUtc.toISO()}|${e.summary}`)
    .sort()
  return createHash('sha256').update(firmas.join('\n')).digest('hex')
}

/**
 * Clasifica cada día de [desdeISO, hastaISO] (ambos inclusive, fechas locales) y
 * devuelve una fila por día con su estado y el hash de su evidencia.
 */
export function construirFilasDisponibilidad(
  events: RosterEvent[],
  desdeISO: string,
  hastaISO: string,
  bufferLlegadaMin: number = DEFAULT_BUFFER_LLEGADA_MIN,
): FilaDisponibilidad[] {
  const desde = DateTime.fromISO(desdeISO, { zone: TZ_LOCAL }).startOf('day')
  const hasta = DateTime.fromISO(hastaISO, { zone: TZ_LOCAL }).startOf('day')

  const filas: FilaDisponibilidad[] = []
  for (let d = desde; d <= hasta; d = d.plus({ days: 1 })) {
    const { estado, eventos } = clasificarDia(
      events,
      { year: d.year, month: d.month, day: d.day },
      bufferLlegadaMin,
    )
    filas.push({ fecha: d.toISODate()!, estado, sourceEventHash: hashEventos(eventos) })
  }
  return filas
}

/**
 * Resuelve la precedencia de override sobre las filas clasificadas.
 *
 * Regla del esquema (availability_overrides): el override GANA sobre el
 * clasificado, SALVO que el evento subyacente haya cambiado —es decir, el hash
 * clasificado actual difiere del hash capturado al crear el override—, en cuyo
 * caso el override se descarta y vuelve a mandar el estado clasificado.
 */
export function aplicarOverrides(
  filas: FilaDisponibilidad[],
  overrides: OverrideDia[],
): FilaAvailability[] {
  const porFecha = new Map(overrides.map((o) => [o.fecha, o]))
  return filas.map((f) => {
    const ov = porFecha.get(f.fecha)
    if (ov && ov.sourceEventHashAtOverride === f.sourceEventHash) {
      // Override vigente: la evidencia del día no cambió desde que se creó.
      return {
        fecha: f.fecha,
        estado: ov.estado,
        source: 'override' as const,
        sourceEventHash: f.sourceEventHash,
      }
    }
    // Sin override, o override obsoleto (el evento cambió) -> clasificado.
    return {
      fecha: f.fecha,
      estado: f.estado,
      source: 'clasificado' as const,
      sourceEventHash: f.sourceEventHash,
    }
  })
}

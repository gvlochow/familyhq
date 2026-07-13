/**
 * Ventana de clasificación del cron. Antes este módulo también materializaba el
 * modelo por-día (availability_days) con su regla de override por hash; eso se
 * retiró al migrar la disponibilidad a tramos intra-día (availability_segments,
 * ver lib/roster/segments y lib/availability). Quedó solo el cálculo de la ventana,
 * que ambas materializaciones comparten.
 *
 * Capa PURA: sin fetch ni Supabase.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from './types'

/**
 * Cuántos meses hacia adelante clasifica el cron, además del mes en curso.
 * Ventana = mes actual + MESES_ADELANTE (por defecto 4 meses de calendario).
 * El feed del rol rara vez publica más allá; ampliar si en la práctica trae más.
 */
export const MESES_ADELANTE = 3

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

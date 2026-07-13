/**
 * Modelo de vista de la grilla mensual del calendario. PURO: sin Next.js ni
 * Supabase. Toma los tramos intra-día de un integrante y arma una grilla alineada
 * de lunes a domingo, con los días de relleno del mes anterior y siguiente para
 * completar las semanas. Cada celda resume su día por dominancia de duración.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import { resumirDia, type TramoVista } from './dia-resumen'
import type { EstadoDisponibilidad } from './estado'

export interface DiaMes {
  fecha: string // yyyy-mm-dd (local Santiago)
  dia: number // número del día del mes
  estado: EstadoDisponibilidad | null
  delMes: boolean // false para los días de relleno (mes anterior/siguiente)
  esHoy: boolean
}

export interface GrillaMes {
  /** Mes mostrado, 'yyyy-mm'. */
  mesISO: string
  /** Días de la grilla, múltiplo de 7, alineados lunes -> domingo. */
  dias: DiaMes[]
}

/**
 * Arma la grilla del mes que contiene `mesRef` (acepta 'yyyy-mm' o 'yyyy-mm-dd').
 * `hoyISO` marca el día de hoy. Las fechas se manejan en America/Santiago.
 */
export function construirGrillaMes(
  tramos: TramoVista[],
  mesRef: string,
  hoyISO: string,
): GrillaMes {
  const base = DateTime.fromISO(mesRef, { zone: TZ_LOCAL })

  const inicioMes = base.startOf('month')
  const finMes = base.endOf('month')
  // luxon: la semana empieza el lunes (ISO). startOf/endOf('week') alinean la grilla.
  const inicioGrilla = inicioMes.startOf('week')
  const finGrilla = finMes.endOf('week')

  const dias: DiaMes[] = []
  for (let d = inicioGrilla.startOf('day'); d <= finGrilla; d = d.plus({ days: 1 })) {
    const fecha = d.toISODate()!
    dias.push({
      fecha,
      dia: d.day,
      estado: resumirDia(tramos, fecha),
      delMes: d.month === inicioMes.month && d.year === inicioMes.year,
      esHoy: fecha === hoyISO,
    })
  }

  return { mesISO: inicioMes.toFormat('yyyy-MM'), dias }
}

/**
 * Modelo de vista de la grilla mensual FAMILIAR del calendario. PURO: sin Next.js
 * ni Supabase. A diferencia de mes.ts (un integrante, celda coloreada por su
 * estado), acá cada celda resume el día de TODOS los integrantes: la unidad es la
 * familia. La UI muestra quién está fuera cada día; "todos en casa" es el default
 * tranquilo.
 *
 * Reusa resumirDia (dia-resumen) por integrante y por día: misma regla de resumen
 * (precedencia con piso) que la celda por-integrante y el chip del home.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import { resumirDia, type TramoVista } from './dia-resumen'
import type { EstadoDisponibilidad } from './estado'

/** Un integrante con sus tramos, para armar la grilla familiar. */
export interface MiembroCalendario {
  id: string
  nombre: string
  inicial: string
  tramos: TramoVista[]
}

/** Resumen del día de un integrante (para el indicador de la celda). */
export interface MiembroDia {
  id: string
  inicial: string
  nombre: string
  estado: EstadoDisponibilidad | null
  /** true si el día es fuera PARCIAL (mixto); ver resumirDia. */
  parcial: boolean
}

export interface DiaMesFamilia {
  fecha: string // yyyy-mm-dd (local Santiago)
  dia: number
  delMes: boolean // false para los días de relleno del mes vecino
  esHoy: boolean
  /** Resumen por integrante ese día. Vacío en los días de relleno. */
  miembros: MiembroDia[]
}

export interface GrillaMesFamilia {
  mesISO: string
  dias: DiaMesFamilia[]
}

/**
 * Arma la grilla familiar del mes que contiene `mesRef` ('yyyy-mm' o 'yyyy-mm-dd'),
 * alineada lunes→domingo y múltiplo de 7. Cada día del mes lleva el resumen de
 * cada integrante; los días de relleno no (no muestran indicadores).
 */
export function construirGrillaMesFamilia(
  miembros: MiembroCalendario[],
  mesRef: string,
  hoyISO: string,
): GrillaMesFamilia {
  const base = DateTime.fromISO(mesRef, { zone: TZ_LOCAL })
  const inicioMes = base.startOf('month')
  const finMes = base.endOf('month')
  const inicioGrilla = inicioMes.startOf('week')
  const finGrilla = finMes.endOf('week')

  const dias: DiaMesFamilia[] = []
  for (let d = inicioGrilla.startOf('day'); d <= finGrilla; d = d.plus({ days: 1 })) {
    const fecha = d.toISODate()!
    const delMes = d.month === inicioMes.month && d.year === inicioMes.year
    dias.push({
      fecha,
      dia: d.day,
      delMes,
      esHoy: fecha === hoyISO,
      miembros: delMes
        ? miembros.map((m) => {
            const r = resumirDia(m.tramos, fecha)
            return {
              id: m.id,
              inicial: m.inicial,
              nombre: m.nombre,
              estado: r?.estado ?? null,
              parcial: r?.parcial ?? false,
            }
          })
        : [],
    })
  }

  return { mesISO: inicioMes.toFormat('yyyy-MM'), dias }
}

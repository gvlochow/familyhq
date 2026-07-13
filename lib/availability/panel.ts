/**
 * Modelo de vista del panel de disponibilidad del home. PURO: sin Next.js ni
 * Supabase. Toma los tramos intra-día de un integrante (availability_segments, ya
 * leídos y acotados por RLS) y arma lo que la UI necesita: el estado de AHORA,
 * hasta qué instante dura el tramo actual, y la tira resumida de los próximos días.
 *
 * DESIGN.md: el panel muestra el estado ACTUAL en grande ("fuera hasta el sáb
 * 15:00") y el resto de la semana en menor peso. No es una tabla de eventos.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import { estadoEnInstante, resumirDia, type TramoVista } from './dia-resumen'
import type { EstadoDisponibilidad } from './estado'

// Re-exportados por compatibilidad: varios módulos los importan desde './panel'.
export { normalizarEstado, type EstadoDisponibilidad } from './estado'

/** Un día de la tira semanal. `estado` es el resumen del día; null si no hay dato. */
export interface DiaPanel {
  fecha: string // yyyy-mm-dd (local Santiago)
  estado: EstadoDisponibilidad | null
  esHoy: boolean
}

export interface PanelSemana {
  /** Estado en este instante; null si no hay tramo que lo cubra (rol sin sincronizar). */
  estadoAhora: EstadoDisponibilidad | null
  /**
   * Instante (UTC, ISO) en que termina el tramo actual, si cae DENTRO de la
   * ventana. null si no hay estadoAhora o si el tramo se extiende más allá de la
   * ventana (se lee como "constante", sin un "hasta" que mostrar).
   */
  finActualISO: string | null
  dias: DiaPanel[]
}

/**
 * Arma el panel de la semana desde ahora. `estadoAhora` es intra-día (el tramo que
 * cubre el instante); los días de la tira se resumen por dominancia de duración.
 *
 * @param tramos filas {inicioUtc, finUtc, estado} de un integrante (orden libre).
 * @param nowISO instante actual (ISO); inyectable para tests deterministas.
 * @param dias   tamaño de la ventana en días (hoy incluido).
 */
export function construirPanelSemana(
  tramos: TramoVista[],
  nowISO: string,
  dias = 7,
): PanelSemana {
  const ahora = estadoEnInstante(tramos, nowISO)

  const hoy = DateTime.fromISO(nowISO, { zone: TZ_LOCAL }).startOf('day')
  const finVentana = hoy.plus({ days: dias }).toMillis()

  const out: DiaPanel[] = []
  for (let i = 0; i < dias; i++) {
    const fecha = hoy.plus({ days: i }).toISODate()!
    out.push({ fecha, estado: resumirDia(tramos, fecha), esHoy: i === 0 })
  }

  // Solo mostramos "hasta" si el cambio ocurre dentro de la ventana; un tramo que
  // se extiende más allá se lee como constante (sin un "hasta" útil que anunciar).
  const finActualISO =
    ahora && DateTime.fromISO(ahora.finUtc).toMillis() < finVentana ? ahora.finUtc : null

  return { estadoAhora: ahora?.estado ?? null, finActualISO, dias: out }
}

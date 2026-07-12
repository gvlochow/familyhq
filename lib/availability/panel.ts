/**
 * Modelo de vista del panel de disponibilidad del home. PURO: sin Next.js ni
 * Supabase. Toma las filas de availability_days (ya leídas y acotadas por RLS) y
 * arma lo que la UI necesita: el estado de HOY, hasta cuándo dura, y la tira de
 * los próximos días. La presentación (colores, íconos, copy) vive en el componente.
 *
 * DESIGN.md: el panel muestra el estado ACTUAL en grande y el resto de la semana
 * en menor peso. No es una tabla de eventos.
 */
import { DateTime } from 'luxon'
import { Estado, TZ_LOCAL } from '../roster/types'

/**
 * Los 4 estados materializados en availability_days. La fuente de verdad es el
 * enum Estado del clasificador: esta unión se deriva de sus valores, así no hay
 * dos vocabularios que puedan divergir.
 */
export type EstadoDisponibilidad = `${Estado}`

const ESTADOS_VALIDOS = new Set<string>(Object.values(Estado))

/**
 * Convierte un estado crudo de la base a la unión tipada. Un valor inesperado
 * (drift de esquema, override mal escrito) -> null: la UI degrada a "sin
 * información" en vez de crashear al indexar el mapa de presentación.
 */
export function normalizarEstado(crudo: string): EstadoDisponibilidad | null {
  return ESTADOS_VALIDOS.has(crudo) ? (crudo as EstadoDisponibilidad) : null
}

/** Un día de la tira semanal. `estado` es null si no hay dato materializado para ese día. */
export interface DiaPanel {
  fecha: string // yyyy-mm-dd (local Santiago)
  estado: EstadoDisponibilidad | null
  esHoy: boolean
}

export interface PanelSemana {
  /** Estado de hoy; null si no hay dato (rol sin conectar/sincronizar). */
  estadoHoy: EstadoDisponibilidad | null
  /**
   * Fecha en que el estado de hoy deja de aplicar (primer día con estado CONOCIDO
   * distinto). null si el estado se mantiene toda la ventana, no hay estadoHoy, o
   * los días siguientes no tienen dato (un hueco no cuenta como cambio).
   */
  cambiaEl: string | null
  dias: DiaPanel[]
}

/**
 * Arma el panel de la semana desde hoy. La granularidad es por día (lo que
 * guarda availability_days): "hasta cuándo" es day-granular, no intra-día.
 *
 * @param rows  filas {fecha, estado} de un integrante (el orden no importa).
 * @param hoyISO fecha local de hoy en Santiago (yyyy-mm-dd); inyectable para tests.
 * @param dias  tamaño de la ventana (hoy incluido).
 */
export function construirPanelSemana(
  rows: { fecha: string; estado: string }[],
  hoyISO: string,
  dias = 7,
): PanelSemana {
  const porFecha = new Map(rows.map((r) => [r.fecha, normalizarEstado(r.estado)]))
  const hoy = DateTime.fromISO(hoyISO, { zone: TZ_LOCAL }).startOf('day')

  const out: DiaPanel[] = []
  for (let i = 0; i < dias; i++) {
    const fecha = hoy.plus({ days: i }).toISODate()!
    out.push({ fecha, estado: porFecha.get(fecha) ?? null, esHoy: i === 0 })
  }

  const estadoHoy = out[0].estado
  let cambiaEl: string | null = null
  if (estadoHoy) {
    for (const d of out.slice(1)) {
      // Un día SIN dato (estado null) no cuenta como cambio: no sabemos qué pasa
      // ahí, y anunciar un falso "hasta el X" sobre un hueco confunde. Solo corta
      // la racha un día con estado conocido y distinto al de hoy.
      if (d.estado && d.estado !== estadoHoy) {
        cambiaEl = d.fecha
        break
      }
    }
  }

  return { estadoHoy, cambiaEl, dias: out }
}

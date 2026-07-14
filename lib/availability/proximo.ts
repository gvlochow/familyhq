/**
 * Feed "Próximo en la casa": los próximos CAMBIOS de disponibilidad de la familia
 * derivados de los tramos, para el Inicio (estilo forecast). PURO: sin Next.js ni
 * Supabase.
 *
 * En esta fase el feed solo trae eventos de disponibilidad (quién llega / quién
 * sale). Las tareas y eventos familiares se sumarán a este mismo feed cuando
 * existan esas entidades (hoy no hay tabla ni UI); por eso el tipo de salida es
 * deliberadamente simple y ordenable por instante junto a lo que venga después.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import { normalizarEstado, type EstadoDisponibilidad } from './estado'
import type { TramoVista } from './dia-resumen'

export interface MiembroTramos {
  id: string
  nombre: string
  tramos: TramoVista[]
}

/** Un cambio de disponibilidad próximo: alguien LLEGA a casa o SALE. */
export interface CambioDisponibilidad {
  cuando: string // instante UTC (ISO)
  miembroId: string
  miembro: string
  tipo: 'llega' | 'sale'
  /** Estado al que entra (en_casa/standby si llega, fuera si sale). */
  estado: EstadoDisponibilidad
}

const EN_CASA_ISH = new Set<EstadoDisponibilidad>(['en_casa', 'standby_casa'])

/**
 * Cambios de disponibilidad de todos los integrantes entre ahora y +`dias` días,
 * ordenados por cuándo. "Llega" = transición de fuera a estar en casa; "sale" =
 * de estar en casa a fuera. Las transiciones a/desde "por_confirmar" se omiten
 * (no son un llega/sale nítido).
 */
export function construirProximos(
  miembros: MiembroTramos[],
  nowISO: string,
  dias = 7,
): CambioDisponibilidad[] {
  const now = DateTime.fromISO(nowISO).toMillis()
  const hasta = DateTime.fromISO(nowISO, { zone: TZ_LOCAL })
    .startOf('day')
    .plus({ days: dias })
    .toMillis()

  const out: CambioDisponibilidad[] = []
  for (const m of miembros) {
    const orden = [...m.tramos].sort(
      (a, b) => DateTime.fromISO(a.inicioUtc).toMillis() - DateTime.fromISO(b.inicioUtc).toMillis(),
    )
    for (let i = 1; i < orden.length; i++) {
      const inicioMs = DateTime.fromISO(orden[i].inicioUtc).toMillis()
      if (inicioMs <= now || inicioMs > hasta) continue

      const previo = normalizarEstado(orden[i - 1].estado)
      const actual = normalizarEstado(orden[i].estado)
      if (!previo || !actual) continue

      if (previo === 'fuera' && EN_CASA_ISH.has(actual)) {
        out.push(cambio(orden[i].inicioUtc, m, 'llega', actual))
      } else if (EN_CASA_ISH.has(previo) && actual === 'fuera') {
        out.push(cambio(orden[i].inicioUtc, m, 'sale', actual))
      }
    }
  }

  out.sort((a, b) => DateTime.fromISO(a.cuando).toMillis() - DateTime.fromISO(b.cuando).toMillis())
  return out
}

function cambio(
  cuando: string,
  m: MiembroTramos,
  tipo: 'llega' | 'sale',
  estado: EstadoDisponibilidad,
): CambioDisponibilidad {
  return { cuando, miembroId: m.id, miembro: m.nombre, tipo, estado }
}

/**
 * Feed unificado "Próximo en la casa": mezcla los cambios de disponibilidad de la
 * familia con las tareas/eventos de la agenda, ordenados por cuándo. PURO.
 *
 * Es el punto donde convergen las dos fuentes del Inicio. La recurrencia, cuando
 * exista, se sumará como una tercera fuente acá mismo.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import type { CambioDisponibilidad } from '../availability/proximo'
import type { AgendaItem } from './tipos'

interface Base {
  clave: string
  /** Instante (epoch ms) para ordenar. */
  instanteMs: number
  /** ISO del instante, para formatear la etiqueta "cuándo". */
  cuandoISO: string
  /** Si el item tiene hora (true) o es a fecha seca (false). */
  conHora: boolean
}

export type FilaFeed =
  | (Base & { clase: 'disponibilidad'; cambio: CambioDisponibilidad })
  | (Base & { clase: 'agenda'; item: AgendaItem })

/** Instante local de un item de agenda: su fecha + hora, o el inicio del día. */
function instanteAgenda(item: AgendaItem): DateTime {
  const base = DateTime.fromISO(item.fecha, { zone: TZ_LOCAL }).startOf('day')
  if (!item.hora) return base
  const [h, m] = item.hora.split(':').map(Number)
  return base.set({ hour: h, minute: m })
}

/**
 * Une cambios de disponibilidad + items de agenda en una lista ordenada por
 * cuándo, desde ahora hasta +`dias` días. Excluye tareas ya completadas y todo lo
 * anterior a hoy. Los cambios de disponibilidad ya vienen acotados a la ventana.
 */
export function construirFeed(
  cambios: CambioDisponibilidad[],
  agenda: AgendaItem[],
  nowISO: string,
  dias = 7,
): FilaFeed[] {
  const inicioHoy = DateTime.fromISO(nowISO, { zone: TZ_LOCAL }).startOf('day')
  const finVentana = inicioHoy.plus({ days: dias })

  const filas: FilaFeed[] = cambios.map((c) => ({
    clase: 'disponibilidad',
    clave: `disp-${c.miembroId}-${c.cuando}`,
    instanteMs: DateTime.fromISO(c.cuando).toMillis(),
    cuandoISO: c.cuando,
    conHora: true,
    cambio: c,
  }))

  for (const item of agenda) {
    if (item.tipo === 'tarea' && item.completado) continue
    const cuando = instanteAgenda(item)
    // Desde el inicio de hoy (una tarea que vence hoy sigue vigente) hasta la ventana.
    if (cuando < inicioHoy || cuando >= finVentana) continue
    filas.push({
      clase: 'agenda',
      clave: `agenda-${item.id}`,
      instanteMs: cuando.toMillis(),
      cuandoISO: cuando.toISO()!,
      conHora: item.hora !== null,
      item,
    })
  }

  return filas.sort((a, b) => a.instanteMs - b.instanteMs)
}

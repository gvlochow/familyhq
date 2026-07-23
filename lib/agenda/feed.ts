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

/** Instante local (fecha + "HH:MM") de un día. */
function instanteEn(fecha: string, hhmm: string): DateTime {
  const [h, m] = hhmm.split(':').map(Number)
  return DateTime.fromISO(fecha, { zone: TZ_LOCAL }).startOf('day').set({ hour: h, minute: m })
}

/** Instante local de un item de agenda: su fecha + hora, o el inicio del día. */
function instanteAgenda(item: AgendaItem): DateTime {
  const base = DateTime.fromISO(item.fecha, { zone: TZ_LOCAL }).startOf('day')
  if (!item.hora) return base
  return instanteEn(item.fecha, item.hora)
}

/**
 * ¿Un EVENTO con hora ya terminó respecto de `ahora`? Su término es hora_fin, o su
 * propia hora si no tiene término. Solo aplica a eventos con hora: una tarea
 * vencida sigue siendo "próxima" (no se olvida), y un evento de todo el día no
 * termina por hora.
 */
function eventoTerminado(item: AgendaItem, ahora: DateTime): boolean {
  if (item.tipo !== 'evento' || !item.hora) return false
  return instanteEn(item.fecha, item.horaFin ?? item.hora) < ahora
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
  const ahora = DateTime.fromISO(nowISO)
  const inicioHoy = ahora.setZone(TZ_LOCAL).startOf('day')
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
    // Un evento cuyo término ya pasó no es "próximo" (una tarea vencida sí queda).
    if (eventoTerminado(item, ahora)) continue
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

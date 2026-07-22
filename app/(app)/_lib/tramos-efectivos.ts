import type { SupabaseClient } from "@supabase/supabase-js"
import { DateTime } from "luxon"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { TramoVista } from "@/lib/availability/dia-resumen"
import {
  componerTramosPorMiembro,
  type MiembroHorario,
} from "@/lib/availability/tramos"
import {
  tramosEventosPorMiembro,
  type EventoDisponibilidad,
} from "@/lib/availability/eventos"
import { esRecurrencia, ocurrencias } from "@/lib/agenda/recurrencia"

/**
 * Carga los tramos EFECTIVOS de disponibilidad (clasificado/fijo + default +
 * overrides) por integrante, para una ventana [winInicioUtc, winFinUtc).
 *
 * Server-side, compartido por el Inicio y el Calendario: hace los dos queries
 * (availability_segments + availability_overrides) acotados por RLS al hogar y
 * delega el armado en la lógica pura (lib/availability/tramos). Ambos queries piden
 * los tramos/overrides que SOLAPAN la ventana (inicio < finVentana && fin > inicioVentana).
 *
 * Vive en app/(app)/_lib (carpeta privada, sin ruta) porque toca Supabase y no puede
 * ir en lib/ (dominio puro). Recibe el cliente ya creado, como el resto del acceso a
 * datos del proyecto.
 */
export async function cargarTramosEfectivos(
  supabase: SupabaseClient,
  miembros: MiembroHorario[],
  winInicioUtc: string,
  winFinUtc: string,
): Promise<Map<string, TramoVista[]>> {
  if (miembros.length === 0) {
    return componerTramosPorMiembro([], [], [], winInicioUtc, winFinUtc)
  }

  const memberIds = miembros.map((m) => m.id)

  // Rango de FECHAS locales que cubre la ventana, para filtrar los eventos de
  // agenda por día (los eventos no cruzan medianoche: hora_fin > hora el mismo día).
  const localDesde = DateTime.fromISO(winInicioUtc).setZone(TZ_LOCAL).toISODate()!
  const localHasta = DateTime.fromISO(winFinUtc).setZone(TZ_LOCAL).toISODate()!

  const [
    { data: segmentos },
    { data: overrides },
    { data: eventosPuntuales },
    { data: reglasEvento },
    { data: excs },
  ] = await Promise.all([
    supabase
      .from("availability_segments")
      .select("member_id, inicio_utc, fin_utc, estado")
      .in("member_id", memberIds)
      .lt("inicio_utc", winFinUtc)
      .gt("fin_utc", winInicioUtc),
    supabase
      .from("availability_overrides")
      .select("member_id, inicio_utc, fin_utc, estado")
      .in("member_id", memberIds)
      .lt("inicio_utc", winFinUtc)
      .gt("fin_utc", winInicioUtc),
    // Eventos puntuales opt-in con rango horario (RLS acota al hogar).
    supabase
      .from("agenda_items")
      .select("fecha, hora, hora_fin, asignado_a")
      .eq("afecta_disponibilidad", true)
      .eq("tipo", "evento")
      .not("hora", "is", null)
      .not("hora_fin", "is", null)
      .gte("fecha", localDesde)
      .lte("fecha", localHasta),
    // Reglas recurrentes opt-in (se expanden a ocurrencias abajo).
    supabase
      .from("recurring_activities")
      .select("id, hora, hora_fin, asignado_a, recurrence, fecha_inicio, fecha_fin")
      .eq("afecta_disponibilidad", true)
      .eq("tipo", "evento")
      .not("hora", "is", null)
      .not("hora_fin", "is", null),
    // Ocurrencias omitidas ("esta vez no"): se descartan de la capa de eventos.
    supabase
      .from("recurring_exceptions")
      .select("recurring_activity_id, fecha")
      .gte("fecha", localDesde)
      .lte("fecha", localHasta),
  ])

  const omitidas = new Set((excs ?? []).map((e) => `${e.recurring_activity_id}:${e.fecha}`))

  const eventos: EventoDisponibilidad[] = []
  for (const e of eventosPuntuales ?? []) {
    if (!e.hora || !e.hora_fin) continue
    eventos.push({
      fecha: e.fecha,
      hora: e.hora.slice(0, 5),
      horaFin: e.hora_fin.slice(0, 5),
      asignados: e.asignado_a ?? [],
    })
  }
  for (const r of reglasEvento ?? []) {
    if (!r.hora || !r.hora_fin || !esRecurrencia(r.recurrence)) continue
    const asignados = r.asignado_a ?? []
    if (asignados.length === 0) continue
    for (const fecha of ocurrencias(r.recurrence, localDesde, localHasta, r.fecha_inicio, r.fecha_fin)) {
      if (omitidas.has(`${r.id}:${fecha}`)) continue // "esta vez no"
      eventos.push({
        fecha,
        hora: r.hora.slice(0, 5),
        horaFin: r.hora_fin.slice(0, 5),
        asignados,
      })
    }
  }

  const eventosPorMiembro = tramosEventosPorMiembro(eventos, winInicioUtc, winFinUtc)

  return componerTramosPorMiembro(
    miembros,
    segmentos ?? [],
    overrides ?? [],
    winInicioUtc,
    winFinUtc,
    eventosPorMiembro,
  )
}

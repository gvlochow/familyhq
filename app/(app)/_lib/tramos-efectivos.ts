import type { SupabaseClient } from "@supabase/supabase-js"

import type { TramoVista } from "@/lib/availability/dia-resumen"
import {
  componerTramosPorMiembro,
  type MiembroHorario,
} from "@/lib/availability/tramos"

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

  const [{ data: segmentos }, { data: overrides }] = await Promise.all([
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
  ])

  return componerTramosPorMiembro(
    miembros,
    segmentos ?? [],
    overrides ?? [],
    winInicioUtc,
    winFinUtc,
  )
}

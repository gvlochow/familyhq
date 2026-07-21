/**
 * Combinador de la línea de tiempo EFECTIVA por integrante. PURO: sin Next.js ni
 * Supabase (recibe filas crudas ya leídas).
 *
 * Junta las capas de lectura de disponibilidad en un solo lugar, para que el
 * Inicio y el Calendario no las repitan:
 *   1. tramos clasificados/fijos (availability_segments),
 *   2. el default "en casa" del integrante sin horario (tramosConDefault),
 *   3. los EVENTOS opt-in que marcan 'fuera' a sus asignados (capa derivada),
 *   4. las correcciones manuales (availability_overrides).
 *
 * Precedencia (se apila con aplicarOverrides, reutilizándolo dos veces):
 *   override manual > evento > clasificado/fijo > default.
 * Con capa de eventos vacía el resultado es idéntico al histórico (aplicarOverrides
 * con [] devuelve la base sin tocar).
 *
 * El loader server (app/(app)/_lib/tramos-efectivos) hace los queries y delega el
 * armado acá.
 */
import type { TramoVista } from './dia-resumen'
import { tramosConDefault } from './miembros'
import { aplicarOverrides, type OverrideVista } from './override'

/** Fila de availability_segments tal como llega de la base (subset que se usa). */
export interface SegmentoRow {
  member_id: string
  inicio_utc: string
  fin_utc: string
  estado: string
}

/** Fila de availability_overrides tal como llega de la base (subset que se usa). */
export interface OverrideRow {
  member_id: string
  inicio_utc: string
  fin_utc: string
  estado: string
}

/** Lo mínimo que se necesita del integrante para armar sus tramos. */
export interface MiembroHorario {
  id: string
  tipo_horario: string
}

/**
 * Devuelve, por id de integrante, sus tramos EFECTIVOS en la ventana: lo
 * clasificado/fijo con el default aplicado y los overrides superpuestos encima.
 * Todo integrante de `miembros` queda en el mapa (con arreglo vacío si no tiene
 * base ni overrides).
 */
export function componerTramosPorMiembro(
  miembros: MiembroHorario[],
  segmentos: SegmentoRow[],
  overrides: OverrideRow[],
  winInicioUtc: string,
  winFinUtc: string,
  eventosPorMiembro?: Map<string, TramoVista[]>,
): Map<string, TramoVista[]> {
  const segsPorMiembro = agrupar(segmentos)
  const ovsPorMiembro = agrupar(overrides)

  const out = new Map<string, TramoVista[]>()
  for (const m of miembros) {
    const base = tramosConDefault(
      m.tipo_horario,
      segsPorMiembro.get(m.id) ?? [],
      winInicioUtc,
      winFinUtc,
    )
    // Capa de eventos sobre la base (el evento gana), luego el override manual
    // sobre eso (el override gana). Ambas usan el mismo primitivo aplicarOverrides.
    const eventos = eventosPorMiembro?.get(m.id) ?? []
    const conEventos = aplicarOverrides(base, eventos)
    const ovs: OverrideVista[] = ovsPorMiembro.get(m.id) ?? []
    out.set(m.id, aplicarOverrides(conEventos, ovs))
  }
  return out
}

/** Agrupa filas por member_id, normalizando a la forma TramoVista (inicioUtc/finUtc). */
function agrupar(filas: (SegmentoRow | OverrideRow)[]): Map<string, TramoVista[]> {
  const map = new Map<string, TramoVista[]>()
  for (const f of filas) {
    const arr = map.get(f.member_id) ?? []
    arr.push({ inicioUtc: f.inicio_utc, finUtc: f.fin_utc, estado: f.estado })
    map.set(f.member_id, arr)
  }
  return map
}

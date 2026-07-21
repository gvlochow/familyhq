/**
 * Capa de disponibilidad derivada de los EVENTOS (agenda) marcados como
 * "afecta_disponibilidad". PURO: sin Next.js ni Supabase.
 *
 * Un evento opt-in marca a sus asignados como 'fuera' durante su ventana local
 * [hora, hora_fin). Esta capa se superpone al clasificado y por debajo de los
 * overrides manuales (ver componerTramosPorMiembro): el evento gana sobre la base,
 * el override manual gana sobre el evento. No se materializa: se arma al leer.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import type { TramoVista } from './dia-resumen'

/** Estado que impone un evento sobre sus asignados (fijo por diseño). */
const ESTADO_EVENTO = 'fuera'

/** Un evento (puntual u ocurrencia recurrente) que afecta la disponibilidad. */
export interface EventoDisponibilidad {
  /** yyyy-mm-dd local. */
  fecha: string
  /** "HH:MM" local (inicio). */
  hora: string
  /** "HH:MM" local (fin, > hora). */
  horaFin: string
  /** ids de integrantes asignados. */
  asignados: string[]
}

/**
 * Devuelve, por id de integrante, los tramos 'fuera' que le imponen sus eventos
 * dentro de la ventana [winInicioUtc, winFinUtc). Convierte cada evento de hora
 * LOCAL a UTC, recorta a la ventana y fusiona los solapes del mismo integrante.
 */
export function tramosEventosPorMiembro(
  eventos: EventoDisponibilidad[],
  winInicioUtc: string,
  winFinUtc: string,
): Map<string, TramoVista[]> {
  const winIni = DateTime.fromISO(winInicioUtc).toMillis()
  const winFin = DateTime.fromISO(winFinUtc).toMillis()

  const porMiembro = new Map<string, { i: number; f: number }[]>()
  for (const ev of eventos) {
    if (!ev.hora || !ev.horaFin || ev.asignados.length === 0) continue
    const ini = DateTime.fromISO(`${ev.fecha}T${ev.hora}`, { zone: TZ_LOCAL })
    const fin = DateTime.fromISO(`${ev.fecha}T${ev.horaFin}`, { zone: TZ_LOCAL })
    if (!ini.isValid || !fin.isValid || fin <= ini) continue

    // Recorte a la ventana.
    const i = Math.max(ini.toMillis(), winIni)
    const f = Math.min(fin.toMillis(), winFin)
    if (f <= i) continue

    for (const id of ev.asignados) {
      const arr = porMiembro.get(id) ?? []
      arr.push({ i, f })
      porMiembro.set(id, arr)
    }
  }

  const out = new Map<string, TramoVista[]>()
  for (const [id, intervalos] of porMiembro) {
    out.set(id, fusionarIntervalos(intervalos))
  }
  return out
}

/** Une intervalos solapados o contiguos (todos del mismo estado) en tramos. */
function fusionarIntervalos(intervalos: { i: number; f: number }[]): TramoVista[] {
  const orden = [...intervalos].sort((a, b) => a.i - b.i)
  const out: TramoVista[] = []
  let cur: { i: number; f: number } | null = null
  for (const iv of orden) {
    if (cur && iv.i <= cur.f) {
      cur.f = Math.max(cur.f, iv.f)
    } else {
      if (cur) out.push(tramoDe(cur))
      cur = { ...iv }
    }
  }
  if (cur) out.push(tramoDe(cur))
  return out
}

function tramoDe(x: { i: number; f: number }): TramoVista {
  return {
    inicioUtc: DateTime.fromMillis(x.i, { zone: 'utc' }).toISO()!,
    finUtc: DateTime.fromMillis(x.f, { zone: 'utc' }).toISO()!,
    estado: ESTADO_EVENTO,
  }
}

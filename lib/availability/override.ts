/**
 * Composición de correcciones manuales (availability_overrides) sobre los tramos
 * clasificados/fijos. PURO: sin Next.js ni Supabase.
 *
 * El override NO se materializa en availability_segments (el cron es dueño único de
 * esa tabla y ni lee los overrides). El estado EFECTIVO que ve la UI se arma acá, al
 * leer: sobre la línea de tiempo base (lo clasificado por el rol / el horario fijo, o
 * el default "en casa") se superponen los overrides, y el override SIEMPRE gana
 * dentro de su intervalo. Quitar un override hace reaparecer lo base al instante.
 *
 * Invariante de entrada (la garantiza la Server Action): los overrides de un mismo
 * integrante no se solapan entre sí. Los tramos base son contiguos y sin solape.
 */
import { DateTime } from 'luxon'
import type { TramoVista } from './dia-resumen'

/** Un override tal como llega de availability_overrides (instantes UTC en ISO). */
export interface OverrideVista {
  inicioUtc: string
  finUtc: string
  estado: string
}

/**
 * Superpone `overrides` sobre `base` y devuelve la línea de tiempo efectiva: en
 * cada instante gana el override si alguno lo cubre, si no el tramo base. Los tramos
 * resultantes están ordenados y los contiguos del mismo estado se fusionan. Fuera de
 * donde hay base u override no se emite tramo (hueco = "sin información").
 *
 * Un override puede dar estado donde no había base (p. ej. un integrante variable
 * sin tramos sincronizados): en ese caso el resultado es solo el override.
 */
export function aplicarOverrides(
  base: TramoVista[],
  overrides: OverrideVista[],
): TramoVista[] {
  if (overrides.length === 0) return base

  const ms = (iso: string) => DateTime.fromISO(iso).toMillis()

  // Fronteras: todos los bordes de base y overrides.
  const fronteras = new Set<number>()
  for (const t of base) {
    fronteras.add(ms(t.inicioUtc))
    fronteras.add(ms(t.finUtc))
  }
  for (const o of overrides) {
    fronteras.add(ms(o.inicioUtc))
    fronteras.add(ms(o.finUtc))
  }
  const cortes = [...fronteras].sort((a, b) => a - b)

  const baseMs = base.map((t) => ({ i: ms(t.inicioUtc), f: ms(t.finUtc), estado: t.estado }))
  const ovMs = overrides.map((o) => ({ i: ms(o.inicioUtc), f: ms(o.finUtc), estado: o.estado }))

  const cubre = (arr: { i: number; f: number; estado: string }[], a: number, b: number) =>
    arr.find((x) => x.i <= a && x.f >= b)

  const trozos: TramoVista[] = []
  for (let k = 0; k < cortes.length - 1; k++) {
    const a = cortes[k]
    const b = cortes[k + 1]
    const ganador = cubre(ovMs, a, b) ?? cubre(baseMs, a, b) // override gana; si no, base
    if (!ganador) continue // hueco: ni base ni override cubren este trozo
    trozos.push({
      inicioUtc: DateTime.fromMillis(a, { zone: 'utc' }).toISO()!,
      finUtc: DateTime.fromMillis(b, { zone: 'utc' }).toISO()!,
      estado: ganador.estado,
    })
  }

  return fusionar(trozos)
}

/** Fusiona tramos contiguos del mismo estado (misma semántica que roster/segments.fusionar). */
function fusionar(tramos: TramoVista[]): TramoVista[] {
  const out: TramoVista[] = []
  for (const t of tramos) {
    const last = out[out.length - 1]
    if (last && last.estado === t.estado && last.finUtc === t.inicioUtc) {
      last.finUtc = t.finUtc
    } else {
      out.push({ ...t })
    }
  }
  return out
}

/**
 * Modelo de escritura del override manual ("Actualizar mi estado"). PURO: sin
 * Next.js ni Supabase.
 *
 * Define QUÉ estados puede afirmar un usuario a mano y CÓMO se traduce la elección
 * de "hasta cuándo" a un intervalo [inicioUtc, finUtc). El inicio es AHORA (una
 * corrección del estado actual), salvo "todo el día", que arranca al inicio del día
 * local para cubrir también la mañana ya transcurrida.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'
import type { EstadoDisponibilidad } from './estado'

/**
 * Estados que el usuario PUEDE fijar a mano. Subconjunto de EstadoDisponibilidad:
 * se excluye 'por_confirmar', que expresa la incertidumbre del clasificador, no una
 * afirmación deliberada de una persona.
 */
export const ESTADOS_OVERRIDE = ['en_casa', 'fuera', 'standby_casa'] as const
export type EstadoOverride = (typeof ESTADOS_OVERRIDE)[number]

// Comprobación en compilación de que EstadoOverride ⊆ EstadoDisponibilidad.
const _: EstadoDisponibilidad = '' as EstadoOverride
void _

export function esEstadoOverride(x: string): x is EstadoOverride {
  return (ESTADOS_OVERRIDE as readonly string[]).includes(x)
}

/** Opciones de duración del override. Todas garantizan finUtc > inicioUtc. */
export const PRESETS_FIN = ['1h', '3h', 'restoDia', 'todoElDia'] as const
export type PresetFin = (typeof PRESETS_FIN)[number]

export const PRESET_LABEL: Record<PresetFin, string> = {
  '1h': 'Por 1 hora',
  '3h': 'Por 3 horas',
  restoDia: 'El resto del día',
  todoElDia: 'Todo el día',
}

export function esPresetFin(x: string): x is PresetFin {
  return (PRESETS_FIN as readonly string[]).includes(x)
}

/**
 * Traduce un preset a un intervalo UTC [inicioUtc, finUtc) anclado a `nowISO`.
 * `restoDia` termina en la próxima medianoche local; `todoElDia` además adelanta el
 * inicio al comienzo del día local. Todos cumplen fin > inicio.
 */
export function intervaloDesde(
  preset: PresetFin,
  nowISO: string,
): { inicioUtc: string; finUtc: string } {
  const ahora = DateTime.fromISO(nowISO, { zone: TZ_LOCAL })
  const proximaMedianoche = ahora.startOf('day').plus({ days: 1 })

  let inicio = ahora
  let fin: DateTime
  switch (preset) {
    case '1h':
      fin = ahora.plus({ hours: 1 })
      break
    case '3h':
      fin = ahora.plus({ hours: 3 })
      break
    case 'restoDia':
      fin = proximaMedianoche
      break
    case 'todoElDia':
      inicio = ahora.startOf('day')
      fin = proximaMedianoche
      break
  }

  return { inicioUtc: inicio.toUTC().toISO()!, finUtc: fin.toUTC().toISO()! }
}

/**
 * Intervalo UTC [inicioUtc, finUtc) para una ventana horaria explícita ("HH:MM" a
 * "HH:MM") del día local `fechaISO`. No cruza medianoche: si fin ≤ inicio, el
 * llamador debe rechazarlo (la Server Action también valida fin > inicio).
 */
export function intervaloHorario(
  fechaISO: string,
  inicioHHMM: string,
  finHHMM: string,
): { inicioUtc: string; finUtc: string } {
  const dia = DateTime.fromISO(fechaISO, { zone: TZ_LOCAL }).startOf('day')
  const [hi, mi] = inicioHHMM.split(':').map(Number)
  const [hf, mf] = finHHMM.split(':').map(Number)
  const inicio = dia.set({ hour: hi, minute: mi })
  const fin = dia.set({ hour: hf, minute: mf })
  return { inicioUtc: inicio.toUTC().toISO()!, finUtc: fin.toUTC().toISO()! }
}

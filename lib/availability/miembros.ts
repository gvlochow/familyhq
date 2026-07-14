/**
 * Helpers de integrantes para la capa de lectura de disponibilidad. PURO.
 */
import type { TramoVista } from './dia-resumen'

/** tipo_horario que significa "sin horario de trabajo": su default es estar en casa. */
export const SIN_HORARIO = 'ninguno'

/**
 * Aplica el default "en casa" a un integrante SIN horario asignado
 * (tipo_horario='ninguno', p. ej. un hijo) que no tiene tramos: se le sintetiza un
 * tramo `en_casa` que cubre toda la ventana. Así se lee "En casa" en vez de "Sin
 * información".
 *
 * Un integrante variable o fijo sin tramos NO recibe este default: queda "sin
 * información" a propósito (no sabemos si el rol no sincronizó o si su horario está
 * a medio configurar; afirmar "en casa" ahí sería mentir sobre su disponibilidad).
 */
export function tramosConDefault(
  tipoHorario: string,
  tramos: TramoVista[],
  ventanaInicioUtc: string,
  ventanaFinUtc: string,
): TramoVista[] {
  if (tramos.length === 0 && tipoHorario === SIN_HORARIO) {
    return [{ inicioUtc: ventanaInicioUtc, finUtc: ventanaFinUtc, estado: 'en_casa' }]
  }
  return tramos
}

/**
 * Vocabulario compartido de estados de disponibilidad para la capa de vista.
 * PURO: sin Next.js ni Supabase. La fuente de verdad es el enum Estado del
 * clasificador (lib/roster); acá se deriva la unión tipada que consume la UI y
 * la normalización de valores crudos de la base.
 *
 * Vive aparte de panel.ts para que panel, mes y dia-resumen lo compartan sin
 * ciclos de importación.
 */
import { Estado } from '../roster/types'

/** Los 4 estados materializados. Derivado de los valores del enum Estado. */
export type EstadoDisponibilidad = `${Estado}`

const ESTADOS_VALIDOS = new Set<string>(Object.values(Estado))

/**
 * Convierte un estado crudo de la base a la unión tipada. Un valor inesperado
 * (drift de esquema, dato mal escrito) -> null: la UI degrada a "sin información"
 * en vez de crashear al indexar el mapa de presentación.
 */
export function normalizarEstado(crudo: string): EstadoDisponibilidad | null {
  return ESTADOS_VALIDOS.has(crudo) ? (crudo as EstadoDisponibilidad) : null
}

/**
 * Orden de precedencia (mayor a menor) de los estados, el mismo criterio del
 * clasificador. Se usa para desempatar el resumen por día cuando dos estados
 * ocupan la misma duración, y para ordenar la leyenda.
 */
export const ORDEN_PRECEDENCIA: readonly EstadoDisponibilidad[] = [
  'fuera',
  'standby_casa',
  'por_confirmar',
  'en_casa',
]

/**
 * Tipo de horario de un member. Espeja el CHECK de la columna
 * members.tipo_horario (migración 20260708122828):
 *   - 'ninguno'  : estado inicial, aún no lo definió (default en el RPC de
 *                  creación de hogar). NO es una opción que el usuario elija.
 *   - 'fijo'     : horario fijo por día → usa fixed_schedules.
 *   - 'variable' : rol irregular → usa roster_connections + clasificador.
 *
 * database.types tipa la columna como `string` (viene así del generador). Este
 * módulo es la fuente de verdad tipada del dominio: nadie más debería tratar el
 * tipo de horario como string suelto.
 */
export type TipoHorario = "ninguno" | "fijo" | "variable"

/** Los tres valores válidos de la columna, incluido 'ninguno'. */
export const TIPOS_HORARIO = ["ninguno", "fijo", "variable"] as const

export function esTipoHorario(valor: unknown): valor is TipoHorario {
  return (
    typeof valor === "string" && (TIPOS_HORARIO as readonly string[]).includes(valor)
  )
}

/**
 * Los tipos que el usuario efectivamente elige en el paso 2 del onboarding.
 * 'ninguno' queda fuera a propósito: es el estado "sin definir", no una opción.
 * El orden importa: 'variable' primero porque es el diferenciador de entrada.
 */
export const TIPOS_HORARIO_SELECCIONABLES = ["variable", "fijo"] as const

export type TipoHorarioSeleccionable =
  (typeof TIPOS_HORARIO_SELECCIONABLES)[number]

export function esTipoHorarioSeleccionable(
  valor: unknown
): valor is TipoHorarioSeleccionable {
  return (
    typeof valor === "string" &&
    (TIPOS_HORARIO_SELECCIONABLES as readonly string[]).includes(valor)
  )
}

/**
 * Tipo de horario de un member. Espeja el CHECK de la columna
 * members.tipo_horario (migración 20260708122828):
 *   - 'ninguno'     : estado inicial, aún no lo definió (default en el RPC de
 *                     creación de hogar). NO es una opción que el usuario elija.
 *   - 'fijo'        : horario fijo por día → usa fixed_schedules.
 *   - 'variable'    : rol irregular → usa roster_connections + clasificador.
 *   - 'sin_horario' : elección explícita "no trabajo con horario" → siempre en
 *                     casa por defecto (sin segmentos, como 'ninguno' pero elegido).
 *
 * database.types tipa la columna como `string` (viene así del generador). Este
 * módulo es la fuente de verdad tipada del dominio: nadie más debería tratar el
 * tipo de horario como string suelto.
 */
export type TipoHorario = "ninguno" | "fijo" | "variable" | "sin_horario"

/** Los valores válidos de la columna, incluido 'ninguno'. */
export const TIPOS_HORARIO = ["ninguno", "fijo", "variable", "sin_horario"] as const

export function esTipoHorario(valor: unknown): valor is TipoHorario {
  return (
    typeof valor === "string" && (TIPOS_HORARIO as readonly string[]).includes(valor)
  )
}

/**
 * Los tipos que el usuario efectivamente elige (paso 2 del onboarding, agregar/
 * editar integrantes, "Mi horario" en Ajustes). 'ninguno' queda fuera a propósito:
 * es el estado "sin definir", no una opción. El orden importa: 'variable' primero
 * porque es el diferenciador de entrada; 'sin_horario' al final (opción tranquila).
 */
export const TIPOS_HORARIO_SELECCIONABLES = ["variable", "fijo", "sin_horario"] as const

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

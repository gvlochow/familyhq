/**
 * Letras de los días de la semana, lunes a domingo. Se indexa con el weekday de
 * luxon menos 1 (weekday: 1 = lunes ... 7 = domingo). Fuente única compartida por
 * el panel del home y el calendario mensual.
 */
export const LETRAS_DIA = ["L", "M", "M", "J", "V", "S", "D"] as const

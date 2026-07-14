/**
 * Dominio del horario fijo por día de semana (members con tipo_horario = 'fijo').
 * Espeja fixed_schedules: una fila por (member_id, dia_semana). Un día sin
 * trabajo lleva hora_inicio/hora_fin en null.
 *
 * Módulo puro: sin Next.js ni Supabase.
 */

/** Día de semana ISO 8601: 1 = lunes ... 7 = domingo. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const DIAS_SEMANA: readonly { dia: DiaSemana; nombre: string }[] = [
  { dia: 1, nombre: "Lunes" },
  { dia: 2, nombre: "Martes" },
  { dia: 3, nombre: "Miércoles" },
  { dia: 4, nombre: "Jueves" },
  { dia: 5, nombre: "Viernes" },
  { dia: 6, nombre: "Sábado" },
  { dia: 7, nombre: "Domingo" },
]

/**
 * Un día en el formulario. Las horas van como "HH:MM" (lo que produce
 * <input type="time">). Cuando trabaja=false, las horas se ignoran al persistir
 * (se guardan null), pero conservan un valor por defecto para no dejar el campo
 * vacío (DESIGN.md: ningún campo de configuración empieza vacío).
 *
 * almuerzaEnCasa: si ese día de trabajo va a casa a almorzar (cuenta como
 * en_casa en ese rango). Las horas de almuerzo solo se persisten si
 * almuerzaEnCasa=true; si no, van null.
 */
export type BloqueDia = {
  dia: DiaSemana
  trabaja: boolean
  horaInicio: string
  horaFin: string
  almuerzaEnCasa: boolean
  horaAlmuerzoInicio: string
  horaAlmuerzoFin: string
}

const HORA_INICIO_DEFECTO = "09:00"
const HORA_FIN_DEFECTO = "18:00"
const ALMUERZO_INICIO_DEFECTO = "13:00"
const ALMUERZO_FIN_DEFECTO = "14:00"

/**
 * Semana precargada: lunes a viernes de 09:00 a 18:00, fin de semana libre.
 * El usuario ajusta desde acá; nunca parte de cero.
 */
export const BLOQUES_POR_DEFECTO: readonly BloqueDia[] = DIAS_SEMANA.map(
  ({ dia }) => ({
    dia,
    trabaja: dia <= 5,
    horaInicio: HORA_INICIO_DEFECTO,
    horaFin: HORA_FIN_DEFECTO,
    almuerzaEnCasa: false,
    horaAlmuerzoInicio: ALMUERZO_INICIO_DEFECTO,
    horaAlmuerzoFin: ALMUERZO_FIN_DEFECTO,
  })
)

/** Fila de fixed_schedules tal como llega de la base. */
export interface FilaFixedSchedule {
  dia_semana: number
  hora_inicio: string | null
  hora_fin: string | null
  almuerza_en_casa: boolean
  hora_almuerzo_inicio: string | null
  hora_almuerzo_fin: string | null
}

/**
 * Reconstruye los 7 bloques desde las filas guardadas de fixed_schedules (para
 * prellenar el editor en Ajustes). Un día sin fila (o sin horas) queda LIBRE con los
 * valores por defecto en los campos. Las horas "HH:MM:SS" se recortan a "HH:MM".
 */
export function bloquesDesdeFilas(filas: FilaFixedSchedule[]): BloqueDia[] {
  const porDia = new Map(filas.map((f) => [f.dia_semana, f]))
  const hhmm = (v: string | null, fallback: string) => (v ? v.slice(0, 5) : fallback)
  return DIAS_SEMANA.map(({ dia }) => {
    const f = porDia.get(dia)
    const trabaja = !!(f && f.hora_inicio && f.hora_fin)
    return {
      dia,
      trabaja,
      horaInicio: hhmm(f?.hora_inicio ?? null, HORA_INICIO_DEFECTO),
      horaFin: hhmm(f?.hora_fin ?? null, HORA_FIN_DEFECTO),
      almuerzaEnCasa: !!f?.almuerza_en_casa,
      horaAlmuerzoInicio: hhmm(f?.hora_almuerzo_inicio ?? null, ALMUERZO_INICIO_DEFECTO),
      horaAlmuerzoFin: hhmm(f?.hora_almuerzo_fin ?? null, ALMUERZO_FIN_DEFECTO),
    }
  })
}

/** "HH:MM" válido en 00:00–23:59. */
export function esHoraValida(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
}

/**
 * Valida la semana completa. Devuelve un mensaje de error legible o null si es
 * válida. Reglas: 7 días (uno por cada DiaSemana); en los días que trabaja,
 * horas válidas y fin estrictamente posterior al inicio.
 */
export function validarBloques(bloques: BloqueDia[]): string | null {
  if (bloques.length !== 7) {
    return "Faltan días por definir."
  }
  const dias = new Set(bloques.map((b) => b.dia))
  if (dias.size !== 7) {
    return "Hay días repetidos o faltantes."
  }
  for (const b of bloques) {
    if (!b.trabaja) continue
    const nombre = DIAS_SEMANA.find((d) => d.dia === b.dia)?.nombre ?? ""
    if (!esHoraValida(b.horaInicio) || !esHoraValida(b.horaFin)) {
      return "Revisa las horas: usa el formato HH:MM."
    }
    if (b.horaFin <= b.horaInicio) {
      return `En ${nombre}, la hora de término debe ser posterior a la de inicio.`
    }
    if (!b.almuerzaEnCasa) continue
    if (
      !esHoraValida(b.horaAlmuerzoInicio) ||
      !esHoraValida(b.horaAlmuerzoFin)
    ) {
      return "Revisa las horas de almuerzo: usa el formato HH:MM."
    }
    if (b.horaAlmuerzoFin <= b.horaAlmuerzoInicio) {
      return `En ${nombre}, el fin del almuerzo debe ser posterior al inicio.`
    }
    // El almuerzo en casa tiene que caer dentro de la jornada.
    if (
      b.horaAlmuerzoInicio < b.horaInicio ||
      b.horaAlmuerzoFin > b.horaFin
    ) {
      return `En ${nombre}, el almuerzo debe estar dentro del horario de trabajo.`
    }
  }
  return null
}

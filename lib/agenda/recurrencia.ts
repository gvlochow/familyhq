/**
 * Dominio de la recurrencia de la agenda: la REGLA y su expansión a ocurrencias.
 * PURO: sin Next.js ni Supabase. Las ocurrencias NO se materializan en la base; se
 * expanden al leer sobre la ventana pedida (mismo espíritu que los overrides de
 * disponibilidad).
 *
 * recurrence se guarda como jsonb; este módulo es la fuente de verdad del dominio
 * (CLAUDE.md: enums tipados, no strings sueltos). Fechas en yyyy-mm-dd locales
 * (America/Santiago, IANA); una ocurrencia es un DÍA, la hora vive en la regla.
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'

/**
 * Regla de recurrencia. v1:
 *  - dia_mes: día N de cada mes (cuentas). Si N supera los días del mes, se ancla al
 *    último día (una cuenta "el 31" cae el 28 en febrero).
 *  - dias_semana: días de la semana (actividades). ISO: 1=lunes ... 7=domingo.
 *  - anual: día N del mes M cada año (cumpleaños). El 29 de febrero cae el 28 en
 *    años no bisiestos (mismo anclaje al último día del mes).
 */
export type Recurrencia =
  | { tipo: 'dia_mes'; dia: number }
  | { tipo: 'dias_semana'; dias: number[] }
  | { tipo: 'anual'; mes: number; dia: number }

/** Valida (y estrecha) un valor crudo de la columna recurrence jsonb. */
export function esRecurrencia(v: unknown): v is Recurrencia {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (r.tipo === 'dia_mes') {
    return Number.isInteger(r.dia) && (r.dia as number) >= 1 && (r.dia as number) <= 31
  }
  if (r.tipo === 'dias_semana') {
    return (
      Array.isArray(r.dias) &&
      r.dias.length > 0 &&
      r.dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    )
  }
  if (r.tipo === 'anual') {
    return (
      Number.isInteger(r.mes) && (r.mes as number) >= 1 && (r.mes as number) <= 12 &&
      Number.isInteger(r.dia) && (r.dia as number) >= 1 && (r.dia as number) <= 31
    )
  }
  return false
}

/**
 * Fechas (yyyy-mm-dd, locales) en que la regla ocurre dentro de [desdeISO, hastaISO]
 * (ambos inclusive), acotadas además a la vigencia [fechaInicio, fechaFin] de la
 * regla. Ordenadas ascendente. Recorre día a día: las ventanas de uso son chicas
 * (feed 7d, tab ~60d) y así el anclaje al fin de mes cae solo.
 */
export function ocurrencias(
  recurrencia: Recurrencia,
  desdeISO: string,
  hastaISO: string,
  fechaInicio: string,
  fechaFin: string | null,
): string[] {
  const dia = (iso: string) => DateTime.fromISO(iso, { zone: TZ_LOCAL }).startOf('day')

  // Rango efectivo = intersección de la ventana con la vigencia de la regla.
  let desde = dia(desdeISO)
  const inicioRegla = dia(fechaInicio)
  if (inicioRegla > desde) desde = inicioRegla

  let hasta = dia(hastaISO)
  if (fechaFin) {
    const finRegla = dia(fechaFin)
    if (finRegla < hasta) hasta = finRegla
  }

  if (hasta < desde) return []

  const out: string[] = []
  for (let d = desde; d <= hasta; d = d.plus({ days: 1 })) {
    if (ocurreEn(recurrencia, d)) out.push(d.toISODate()!)
  }
  return out
}

/** ¿La regla ocurre en el día local `d`? */
function ocurreEn(recurrencia: Recurrencia, d: DateTime): boolean {
  if (recurrencia.tipo === 'dias_semana') {
    return recurrencia.dias.includes(d.weekday) // luxon weekday: 1=lun..7=dom
  }
  if (recurrencia.tipo === 'anual') {
    if (d.month !== recurrencia.mes) return false
    // Anclaje al último día del mes (29-feb -> 28 en años no bisiestos).
    return d.day === Math.min(recurrencia.dia, d.daysInMonth ?? 31)
  }
  // dia_mes: el día pedido, anclado al último día si el mes es más corto.
  const anclado = Math.min(recurrencia.dia, d.daysInMonth ?? 31)
  return d.day === anclado
}

const DIAS_NOMBRE = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MESES_NOMBRE = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Resumen legible para la UI ("cada 5 del mes", "lunes y jueves", "cada 15 de marzo"). */
export function resumenRecurrencia(recurrencia: Recurrencia): string {
  if (recurrencia.tipo === 'dia_mes') return `cada ${recurrencia.dia} del mes`
  if (recurrencia.tipo === 'anual') {
    return `cada ${recurrencia.dia} de ${MESES_NOMBRE[recurrencia.mes - 1]}`
  }
  const nombres = [...recurrencia.dias].sort((a, b) => a - b).map((d) => DIAS_NOMBRE[d - 1])
  if (nombres.length === 1) return `cada ${nombres[0]}`
  const ultimo = nombres[nombres.length - 1]
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`
}

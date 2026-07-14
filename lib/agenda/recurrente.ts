/**
 * Expansión de reglas recurrentes a ocurrencias con forma de AgendaItem. PURO: sin
 * Next.js ni Supabase.
 *
 * Cada ocurrencia se presenta con la MISMA forma que un item puntual (AgendaItem),
 * más los marcadores de recurrencia, para que el feed del Inicio y la tab Tareas los
 * traten igual sin duplicar UI. El id sintético `rec:{ruleId}:{fecha}` identifica la
 * ocurrencia; las acciones lo parsean para tocar recurring_completions / la regla.
 */
import { esTipoAgenda, type AgendaItem, type MiembroRef } from './tipos'
import { esRecurrencia, ocurrencias, resumenRecurrencia } from './recurrencia'

/** Fila cruda de recurring_activities (subconjunto que se expande). */
export interface ReglaRecurrenteDB {
  id: string
  tipo: string
  titulo: string
  hora: string | null
  recurrence: unknown
  asignado_a: string[] | null
  fecha_inicio: string
  fecha_fin: string | null
  created_by: string | null
}

/**
 * id sintético de una ocurrencia recurrente. Distingue las ocurrencias (que no tienen
 * fila propia) de los items puntuales en las listas; las acciones usan recurrenteId +
 * fecha del AgendaItem, no parsean este id.
 */
export function idOcurrencia(ruleId: string, fecha: string): string {
  return `rec:${ruleId}:${fecha}`
}

/**
 * Expande las reglas a ocurrencias (AgendaItem) dentro de [desdeISO, hastaISO]
 * inclusive. `completadas` es el set de claves `${ruleId}:${fecha}` ya hechas.
 * Descarta reglas con tipo o recurrence inválidos (drift de datos). Ordena por fecha.
 */
export function expandirRecurrentes(
  reglas: ReglaRecurrenteDB[],
  completadas: Set<string>,
  desdeISO: string,
  hastaISO: string,
  miembros: Map<string, MiembroRef>,
): AgendaItem[] {
  const out: AgendaItem[] = []
  for (const regla of reglas) {
    if (!esTipoAgenda(regla.tipo) || !esRecurrencia(regla.recurrence)) continue
    const resumen = resumenRecurrencia(regla.recurrence)
    const hora = regla.hora ? regla.hora.slice(0, 5) : null
    const asignados = (regla.asignado_a ?? [])
      .map((id) => miembros.get(id))
      .filter((m): m is MiembroRef => m !== undefined)
    const agregadoPor = regla.created_by ? (miembros.get(regla.created_by)?.nombre ?? null) : null

    for (const fecha of ocurrencias(regla.recurrence, desdeISO, hastaISO, regla.fecha_inicio, regla.fecha_fin)) {
      out.push({
        id: idOcurrencia(regla.id, fecha),
        tipo: regla.tipo,
        titulo: regla.titulo,
        fecha,
        hora,
        completado: completadas.has(`${regla.id}:${fecha}`),
        asignados,
        agregadoPor,
        recurrente: true,
        recurrenteId: regla.id,
        recurrenciaResumen: resumen,
      })
    }
  }
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  return out
}

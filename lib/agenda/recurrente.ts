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
import type { CategoriaRef } from './categorias'

/** Fila cruda de recurring_activities (subconjunto que se expande). */
export interface ReglaRecurrenteDB {
  id: string
  tipo: string
  titulo: string
  hora: string | null
  hora_fin: string | null
  recurrence: unknown
  asignado_a: string[] | null
  fecha_inicio: string
  fecha_fin: string | null
  created_by: string | null
  categoria_id: string | null
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
  categorias: Map<string, CategoriaRef>,
): AgendaItem[] {
  const out: AgendaItem[] = []
  for (const regla of reglas) {
    if (!esTipoAgenda(regla.tipo) || !esRecurrencia(regla.recurrence)) continue
    const resumen = resumenRecurrencia(regla.recurrence)
    const hora = regla.hora ? regla.hora.slice(0, 5) : null
    const horaFin = regla.hora_fin ? regla.hora_fin.slice(0, 5) : null
    const asignados = (regla.asignado_a ?? [])
      .map((id) => miembros.get(id))
      .filter((m): m is MiembroRef => m !== undefined)
    const agregadoPor = regla.created_by ? (miembros.get(regla.created_by)?.nombre ?? null) : null
    const categoria = regla.categoria_id ? (categorias.get(regla.categoria_id) ?? null) : null

    for (const fecha of ocurrencias(regla.recurrence, desdeISO, hastaISO, regla.fecha_inicio, regla.fecha_fin)) {
      out.push({
        id: idOcurrencia(regla.id, fecha),
        tipo: regla.tipo,
        titulo: regla.titulo,
        fecha,
        hora,
        horaFin,
        completado: completadas.has(`${regla.id}:${fecha}`),
        asignados,
        agregadoPor,
        recurrente: true,
        recurrenteId: regla.id,
        recurrenciaResumen: resumen,
        recurrencia: regla.recurrence,
        recurrenteFechaFin: regla.fecha_fin,
        categoria,
      })
    }
  }
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  return out
}

/**
 * Colapsa las ocurrencias a UNA por regla: la PRÓXIMA pendiente (la de fecha más
 * temprana no completada). Evita que una actividad recurrente inunde la lista de
 * Tareas con todas sus ocurrencias del horizonte — ahí se ve una fila por regla que
 * avanza a la siguiente al completarla. (El feed del Inicio NO usa esto: quiere ver
 * cada ocurrencia próxima de la semana.)
 *
 * Asume `ocurrencias` ordenadas por fecha ascendente (como las da expandirRecurrentes):
 * la primera pendiente de cada regla es su próxima.
 */
export function proximaPorRegla(ocurrencias: AgendaItem[]): AgendaItem[] {
  const vistas = new Set<string>()
  const out: AgendaItem[] = []
  for (const it of ocurrencias) {
    const rid = it.recurrenteId
    if (!rid || it.completado || vistas.has(rid)) continue
    vistas.add(rid)
    out.push(it)
  }
  return out
}

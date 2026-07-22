/**
 * Dominio del historial de tareas: eventos de "completado" (tareas puntuales +
 * ocurrencias recurrentes) unificados, para el feed de actividad y el puntaje por
 * integrante. PURO: sin Next.js ni Supabase.
 *
 * Las fechas llegan como ISO (timestamptz de la base, en UTC); se comparan por
 * epoch (Date.parse) para no depender del formato del offset.
 */

/** Un "alguien completó algo" ya resuelto para la vista. */
export interface EventoHistorial {
  titulo: string
  /** Integrante que lo completó (null si no quedó registrado). */
  memberId: string | null
  /** Momento del completado (ISO). */
  completadoAt: string
  /** true si viene de una actividad recurrente (vs. tarea puntual). */
  recurrente: boolean
}

/** Copia ordenada del más reciente al más antiguo (para el feed). */
export function ordenarRecienteDesc(eventos: EventoHistorial[]): EventoHistorial[] {
  return [...eventos].sort(
    (a, b) => Date.parse(b.completadoAt) - Date.parse(a.completadoAt),
  )
}

/**
 * Cuenta cuántas tareas completó cada integrante DESDE `desdeISO` (inclusive).
 * Ignora los eventos sin integrante. Devuelve un mapa memberId -> conteo; el
 * orden/relleno con los integrantes del hogar lo arma quien llama.
 */
export function contarPorMiembro(
  eventos: EventoHistorial[],
  desdeISO: string,
): Map<string, number> {
  const desde = Date.parse(desdeISO)
  const out = new Map<string, number>()
  for (const e of eventos) {
    if (!e.memberId) continue
    if (Date.parse(e.completadoAt) < desde) continue
    out.set(e.memberId, (out.get(e.memberId) ?? 0) + 1)
  }
  return out
}

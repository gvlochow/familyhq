"use client"

import { useState } from "react"

import type {
  GrillaMesFamilia,
  MiembroCalendario,
} from "@/lib/availability/mes-familia"
import type { AgendaItem } from "@/lib/agenda/tipos"
import { MonthGridFamily } from "./month-grid-family"
import { DayDetailSheet } from "./day-detail-sheet"

/**
 * Envoltorio cliente del calendario familiar: la grilla (server-friendly) + el
 * estado del día abierto y su hoja de detalle. La grilla se calcula en el server
 * y llega ya armada; acá solo se maneja la interacción de tocar un día.
 *
 * `agendaPorDia` (tareas/eventos por fecha) alimenta el marcador de la grilla y la
 * lista del detalle del día: el calendario muestra disponibilidad Y agenda en un solo
 * lugar, sin un segundo calendario.
 */
export function CalendarView({
  grilla,
  miembros,
  agendaPorDia,
}: {
  grilla: GrillaMesFamilia
  miembros: MiembroCalendario[]
  agendaPorDia: Record<string, AgendaItem[]>
}) {
  const [dia, setDia] = useState<string | null>(null)

  return (
    <>
      <MonthGridFamily
        grilla={grilla}
        miembros={miembros}
        agendaPorDia={agendaPorDia}
        onDiaClick={setDia}
      />
      {dia && (
        <DayDetailSheet
          fecha={dia}
          miembros={miembros}
          agenda={agendaPorDia[dia] ?? []}
          onClose={() => setDia(null)}
        />
      )}
    </>
  )
}

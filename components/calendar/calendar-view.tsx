"use client"

import { useState } from "react"

import type {
  GrillaMesFamilia,
  MiembroCalendario,
} from "@/lib/availability/mes-familia"
import { MonthGridFamily } from "./month-grid-family"
import { DayDetailSheet } from "./day-detail-sheet"

/**
 * Envoltorio cliente del calendario familiar: la grilla (server-friendly) + el
 * estado del día abierto y su hoja de detalle. La grilla se calcula en el server
 * y llega ya armada; acá solo se maneja la interacción de tocar un día.
 */
export function CalendarView({
  grilla,
  miembros,
}: {
  grilla: GrillaMesFamilia
  miembros: MiembroCalendario[]
}) {
  const [dia, setDia] = useState<string | null>(null)

  return (
    <>
      <MonthGridFamily grilla={grilla} miembros={miembros} onDiaClick={setDia} />
      {dia && (
        <DayDetailSheet fecha={dia} miembros={miembros} onClose={() => setDia(null)} />
      )}
    </>
  )
}

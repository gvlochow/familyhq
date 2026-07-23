"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

import type {
  GrillaMesFamilia,
  MiembroCalendario,
} from "@/lib/availability/mes-familia"
import type { AgendaItem, MiembroRef } from "@/lib/agenda/tipos"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { marcarCompletado, marcarOcurrenciaRecurrente } from "@/app/(app)/tareas/actions"
import { AgendaSheet } from "@/components/agenda/agenda-sheet"
import { MonthGridFamily } from "./month-grid-family"
import { DayDetailSheet } from "./day-detail-sheet"

/**
 * Envoltorio cliente del calendario familiar: la grilla (server-friendly) + el
 * estado del día abierto, su detalle interactivo, la edición y el alta de agenda.
 *
 * `agendaPorDia` alimenta el marcador de la grilla y la lista del detalle. Desde el
 * detalle se puede marcar/desmarcar una tarea y tocar para editar; un botón flotante
 * "+" agrega tarea/evento — el calendario muestra y opera disponibilidad + agenda en
 * un solo lugar.
 */
export function CalendarView({
  grilla,
  miembros,
  agendaPorDia,
  miembrosRef,
  categorias,
  agregadoPor,
  mostrarCategoria,
  hayVariable,
}: {
  grilla: GrillaMesFamilia
  miembros: MiembroCalendario[]
  agendaPorDia: Record<string, AgendaItem[]>
  miembrosRef: MiembroRef[]
  categorias: CategoriaRef[]
  agregadoPor: string | null
  mostrarCategoria: boolean
  hayVariable: boolean
}) {
  const router = useRouter()
  const [dia, setDia] = useState<string | null>(null)
  const [agregar, setAgregar] = useState(false)
  const [editando, setEditando] = useState<AgendaItem | null>(null)
  const [, startTransition] = useTransition()

  function toggle(item: AgendaItem) {
    startTransition(async () => {
      if (item.recurrente && item.recurrenteId) {
        await marcarOcurrenciaRecurrente(item.recurrenteId, item.fecha, !item.completado)
      } else {
        await marcarCompletado(item.id, !item.completado)
      }
      router.refresh()
    })
  }

  function editar(item: AgendaItem) {
    setDia(null) // cierra el detalle para abrir la edición encima sin apilar hojas
    setEditando(item)
  }

  return (
    <>
      <MonthGridFamily
        grilla={grilla}
        miembros={miembros}
        agendaPorDia={agendaPorDia}
        onDiaClick={setDia}
        hayVariable={hayVariable}
      />

      {/* Botón flotante para agregar tarea/evento. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto flex w-full max-w-sm justify-end px-6">
          <button
            type="button"
            onClick={() => setAgregar(true)}
            aria-label="Agregar actividad o evento"
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-95"
          >
            <PlusIcon className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      {dia && (
        <DayDetailSheet
          fecha={dia}
          miembros={miembros}
          agenda={agendaPorDia[dia] ?? []}
          mostrarCategoria={mostrarCategoria}
          onToggle={toggle}
          onEditar={editar}
          onClose={() => setDia(null)}
        />
      )}

      {agregar && (
        <AgendaSheet
          miembros={miembrosRef}
          categorias={categorias}
          agregadoPor={agregadoPor}
          onClose={() => setAgregar(false)}
        />
      )}

      {editando && (
        <AgendaSheet
          miembros={miembrosRef}
          categorias={categorias}
          agregadoPor={agregadoPor}
          editar={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  )
}

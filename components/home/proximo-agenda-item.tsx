"use client"

import { useState } from "react"

import type { AgendaItem, MiembroRef } from "@/lib/agenda/tipos"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { CategoriaChip } from "@/components/agenda/categoria-chip"
import { AgendaSheet } from "@/components/agenda/agenda-sheet"

/**
 * Título de un ítem de agenda en el feed del Inicio, abrible: al tocarlo abre el
 * mismo sheet de detalle/edición que usan Tareas y Calendario (ver, editar,
 * reasignar, cambiar fecha…). Client component porque maneja el estado de apertura.
 */
export function ProximoAgendaItem({
  item,
  mostrarCategoria,
  miembros,
  categorias,
  agregadoPor,
}: {
  item: AgendaItem
  mostrarCategoria: boolean
  miembros: MiembroRef[]
  categorias: CategoriaRef[]
  agregadoPor: string | null
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ver ${item.titulo}`}
        className="flex flex-1 items-center gap-1.5 truncate text-left text-sm text-foreground"
      >
        <span className="truncate font-medium">{item.titulo}</span>
        {item.categoria && (
          <CategoriaChip
            categoria={item.categoria}
            conNombre={mostrarCategoria}
            className="shrink-0 text-xs italic text-muted-foreground/80"
          />
        )}
      </button>

      {abierto && (
        <AgendaSheet
          miembros={miembros}
          categorias={categorias}
          agregadoPor={agregadoPor}
          editar={item}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

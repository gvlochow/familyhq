"use client"

import { useState } from "react"
import { PlusIcon, UserRoundIcon } from "lucide-react"

import type { MiembroRef } from "@/lib/agenda/tipos"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { AgendaSheet } from "@/components/agenda/agenda-sheet"
import { EstadoSheet, type MiembroEditable } from "@/components/home/estado-sheet"

/**
 * Barra de acciones del Inicio (mockup): "Actualizar mi estado" + acceso rápido "+".
 * Fija sobre la tab bar, al alcance del pulgar (DESIGN.md).
 *
 * "Actualizar mi estado" abre el sheet del override manual (corrige la disponibilidad
 * a mano); el "+" abre el sheet para crear una tarea/evento.
 */
export function HomeActions({
  miembros,
  categorias,
  editables,
  agregadoPor,
}: {
  miembros: MiembroRef[]
  categorias: CategoriaRef[]
  editables: MiembroEditable[]
  agregadoPor: string | null
}) {
  const [estado, setEstado] = useState(false)
  const [agregar, setAgregar] = useState(false)

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto w-full max-w-sm px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEstado(true)}
              disabled={editables.length === 0}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              <UserRoundIcon className="size-5" aria-hidden />
              {editables.length > 1 ? "Actualizar estado" : "Actualizar mi estado"}
            </button>
            <button
              type="button"
              onClick={() => setAgregar(true)}
              aria-label="Agregar actividad o evento"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <PlusIcon className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {estado && <EstadoSheet editables={editables} onClose={() => setEstado(false)} />}

      {agregar && (
        <AgendaSheet
          miembros={miembros}
          categorias={categorias}
          agregadoPor={agregadoPor}
          onClose={() => setAgregar(false)}
        />
      )}
    </>
  )
}

"use client"

import { useState } from "react"
import { PlusIcon, UserRoundIcon } from "lucide-react"

import type { MiembroRef } from "@/lib/agenda/tipos"
import { AgendaSheet } from "@/components/agenda/agenda-sheet"

/**
 * Barra de acciones del Inicio (mockup): "Actualizar mi estado" + acceso rápido "+".
 * Fija sobre la tab bar, al alcance del pulgar (DESIGN.md).
 *
 * El "+" abre el sheet para crear una tarea/evento. "Actualizar mi estado" sigue
 * como SHELL (el override manual sobre tramos aún no existe): muestra un aviso
 * "pronto" en vez de fingir una acción.
 */
export function HomeActions({
  miembros,
  agregadoPor,
}: {
  miembros: MiembroRef[]
  agregadoPor: string | null
}) {
  const [aviso, setAviso] = useState(false)
  const [agregar, setAgregar] = useState(false)

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto w-full max-w-sm px-6">
          {aviso && (
            <p className="mb-2 rounded-lg bg-foreground/90 px-3 py-2 text-center text-xs font-medium text-background">
              Muy pronto vas a poder actualizar tu estado a mano.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAviso((v) => !v)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
            >
              <UserRoundIcon className="size-5" aria-hidden />
              Actualizar mi estado
            </button>
            <button
              type="button"
              onClick={() => setAgregar(true)}
              aria-label="Agregar tarea o evento"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <PlusIcon className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {agregar && (
        <AgendaSheet
          miembros={miembros}
          agregadoPor={agregadoPor}
          onClose={() => setAgregar(false)}
        />
      )}
    </>
  )
}

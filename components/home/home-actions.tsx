"use client"

import { useState } from "react"
import { PlusIcon, UserRoundIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Barra de acciones del Inicio (mockup): "Actualizar mi estado" + acceso rápido "+".
 * Fija sobre la tab bar, al alcance del pulgar (DESIGN.md).
 *
 * SHELL por ahora: ni el override manual de estado ni la creación de tareas/eventos
 * existen todavía como features. Los botones muestran un aviso "pronto" para no
 * fingir una acción que no ocurre. Se cablearán cuando esas features se construyan.
 */
export function HomeActions() {
  const [aviso, setAviso] = useState(false)

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto w-full max-w-sm px-6">
        {aviso && (
          <p className="mb-2 rounded-lg bg-foreground/90 px-3 py-2 text-center text-xs font-medium text-background">
            Muy pronto vas a poder actualizar tu estado y agregar tareas o eventos.
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAviso((v) => !v)}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95",
            )}
          >
            <UserRoundIcon className="size-5" aria-hidden />
            Actualizar mi estado
          </button>
          <button
            type="button"
            onClick={() => setAviso((v) => !v)}
            aria-label="Agregar tarea o evento"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <PlusIcon className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

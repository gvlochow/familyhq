"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { actualizarMostrarCategoria } from "@/app/(app)/ajustes/actions"
import { cn } from "@/lib/utils"

/**
 * Sección Agenda de Ajustes: preferencias de cómo se ve la agenda en el hogar.
 * Hoy una sola: mostrar/ocultar el NOMBRE de la categoría junto al título (en Inicio,
 * Tareas y Calendario). El punto de color se muestra igual. Optimista con rollback.
 */
export function AgendaPrefsSection({ mostrarCategoria }: { mostrarCategoria: boolean }) {
  const router = useRouter()
  const [valor, setValor] = useState(mostrarCategoria)
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function alternar() {
    const nuevo = !valor
    setValor(nuevo) // optimista
    setError(null)
    startTransition(async () => {
      const res = await actualizarMostrarCategoria(nuevo)
      if (res.error) {
        setValor(!nuevo) // rollback
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Agenda</h2>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">
            Mostrar el nombre de la categoría
          </span>
          <span className="text-xs text-muted-foreground">
            Junto al título de cada tarea o evento. El punto de color se muestra igual.
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={valor}
          aria-label="Mostrar el nombre de la categoría"
          onClick={alternar}
          disabled={pendiente}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            valor ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 transform rounded-full bg-card shadow-sm transition-transform",
              valor ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

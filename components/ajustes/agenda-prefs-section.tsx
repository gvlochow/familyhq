"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  actualizarMostrarCategoria,
  actualizarOcultarSimbologia,
} from "@/app/(app)/ajustes/actions"
import { cn } from "@/lib/utils"

/**
 * Sección Agenda de Ajustes: preferencias del hogar sobre cómo se ve la agenda y el
 * calendario. Hoy: (1) mostrar/ocultar el NOMBRE de la categoría junto al título;
 * (2) ocultar la simbología (leyenda) del calendario por defecto — el "?" del
 * calendario la muestra igual cuando haga falta. Cada toggle es optimista con rollback.
 */
export function AgendaPrefsSection({
  mostrarCategoria,
  ocultarSimbologia,
}: {
  mostrarCategoria: boolean
  ocultarSimbologia: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Agenda</h2>

      <ToggleRow
        titulo="Mostrar el nombre de la categoría"
        descripcion="Junto al título de cada actividad o evento. El punto de color se muestra igual."
        inicial={mostrarCategoria}
        accion={actualizarMostrarCategoria}
      />

      <ToggleRow
        titulo="Ocultar la simbología del calendario"
        descripcion="Esconde la leyenda de colores por defecto. El « ? » del calendario la muestra cuando la necesites."
        inicial={ocultarSimbologia}
        accion={actualizarOcultarSimbologia}
      />
    </section>
  )
}

/** Una fila con interruptor, optimista y con rollback si la acción falla. */
function ToggleRow({
  titulo,
  descripcion,
  inicial,
  accion,
}: {
  titulo: string
  descripcion: string
  inicial: boolean
  accion: (valor: boolean) => Promise<{ error?: string }>
}) {
  const router = useRouter()
  const [valor, setValor] = useState(inicial)
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function alternar() {
    const nuevo = !valor
    setValor(nuevo) // optimista
    setError(null)
    startTransition(async () => {
      const res = await accion(nuevo)
      if (res.error) {
        setValor(!nuevo) // rollback
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">{titulo}</span>
          <span className="text-xs text-muted-foreground">{descripcion}</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={valor}
          aria-label={titulo}
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
    </div>
  )
}

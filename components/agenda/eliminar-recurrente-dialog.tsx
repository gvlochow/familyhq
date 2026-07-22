"use client"

import { useEffect } from "react"
import { DateTime } from "luxon"
import { CalendarX2Icon, Trash2Icon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { AgendaItem } from "@/lib/agenda/tipos"
import { Button } from "@/components/ui/button"

/**
 * Al borrar una ocurrencia de una actividad recurrente, ofrece las dos opciones que
 * el confirm binario no cubre: OMITIR solo esa fecha ("esta vez no", vía
 * recurring_exceptions) o ELIMINAR la regla completa. La interacción async y el
 * refresh los hace el padre (agenda-tab); acá solo se presentan las opciones.
 */
export function EliminarRecurrenteDialog({
  item,
  onOmitir,
  onEliminarTodo,
  onClose,
}: {
  item: AgendaItem
  onOmitir: () => void
  onEliminarTodo: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const fechaTxt = capitalizar(
    DateTime.fromISO(item.fecha, { zone: TZ_LOCAL }).setLocale("es").toFormat("ccc d LLL"),
  ).replace(".", "")

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Eliminar ${item.titulo}`}
    >
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] dark:bg-black/60"
      />

      <div className="relative flex w-full max-w-xs flex-col gap-4 rounded-2xl bg-card p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {item.titulo}
          </h2>
          <p className="text-sm text-muted-foreground">
            Se repite {item.recurrenciaResumen ?? "cada cierto tiempo"}. ¿Qué quieres hacer?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="lg" className="justify-start" onClick={onOmitir}>
            <CalendarX2Icon className="size-4" />
            Omitir solo la del {fechaTxt}
          </Button>
          <Button
            size="lg"
            className="justify-start bg-destructive text-white hover:bg-destructive/90"
            onClick={onEliminarTodo}
          >
            <Trash2Icon className="size-4" />
            Eliminar toda la actividad
          </Button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

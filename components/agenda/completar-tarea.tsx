"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleIcon } from "lucide-react"

import type { AgendaItem } from "@/lib/agenda/tipos"
import { marcarCompletado, marcarOcurrenciaRecurrente } from "@/app/(app)/tareas/actions"
import { cn } from "@/lib/utils"

/**
 * Botón para completar una tarea de un click (desde el feed del Inicio). Ramifica
 * por recurrencia: una ocurrencia recurrente marca su fila en recurring_completions
 * (por (regla, fecha)), un item puntual marca agenda_items.
 */
export function CompletarTarea({ item }: { item: AgendaItem }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pendiente}
      aria-label="Marcar como hecha"
      onClick={() =>
        startTransition(async () => {
          if (item.recurrente && item.recurrenteId) {
            await marcarOcurrenciaRecurrente(item.recurrenteId, item.fecha, true)
          } else {
            await marcarCompletado(item.id, true)
          }
          router.refresh()
        })
      }
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
        pendiente && "opacity-50",
      )}
    >
      <CircleIcon className="size-5" />
    </button>
  )
}

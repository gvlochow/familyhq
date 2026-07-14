"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleIcon } from "lucide-react"

import { marcarCompletado } from "@/app/(app)/tareas/actions"
import { cn } from "@/lib/utils"

/** Botón para completar una tarea de un click (desde el feed del Inicio). */
export function CompletarTarea({ id }: { id: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pendiente}
      aria-label="Marcar como hecha"
      onClick={() =>
        startTransition(async () => {
          await marcarCompletado(id, true)
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

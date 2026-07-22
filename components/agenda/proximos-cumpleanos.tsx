"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { CakeIcon, Trash2Icon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { AgendaItem } from "@/lib/agenda/tipos"
import { eliminarActividadRecurrente } from "@/app/(app)/tareas/actions"
import { useConfirmar } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

/**
 * "Cumpleaños y fechas anuales": la vista a FUTURO de las reglas recurrentes de
 * tipo anual. La lista principal de Tareas solo expande una ventana corta (~60d),
 * así que un cumpleaños lejano no se vería; acá se muestra la próxima ocurrencia de
 * cada regla anual (ventana de 366d), ordenada por proximidad. Solo lectura +
 * eliminar (crear/editar sigue en el flujo normal, con el patrón "Cada año").
 */
export function ProximosCumpleanos({
  items,
  nowISO,
}: {
  items: AgendaItem[]
  nowISO: string
}) {
  const router = useRouter()
  const confirmar = useConfirmar()
  const [pendiente, startTransition] = useTransition()

  if (items.length === 0) return null

  async function borrar(item: AgendaItem) {
    if (!item.recurrenteId) return
    const ok = await confirmar({
      titulo: `¿Eliminar "${item.titulo}"?`,
      descripcion: "Dejará de aparecer cada año.",
      confirmar: "Eliminar",
      destructivo: true,
    })
    if (!ok) return
    startTransition(async () => {
      await eliminarActividadRecurrente(item.recurrenteId!)
      router.refresh()
    })
  }

  return (
    <section className="mt-2 flex flex-col gap-1">
      <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <CakeIcon className="size-3.5" aria-hidden />
        Cumpleaños y fechas anuales
      </h2>
      <ul className={cn("flex flex-col", pendiente && "opacity-60")}>
        {items.map((item, i) => (
          <FilaCumple
            key={item.id}
            item={item}
            nowISO={nowISO}
            borde={i > 0}
            onBorrar={borrar}
          />
        ))}
      </ul>
    </section>
  )
}

function FilaCumple({
  item,
  nowISO,
  borde,
  onBorrar,
}: {
  item: AgendaItem
  nowISO: string
  borde: boolean
  onBorrar: (i: AgendaItem) => void
}) {
  const fecha = DateTime.fromISO(item.fecha, { zone: TZ_LOCAL }).startOf("day")
  const hoy = DateTime.fromISO(nowISO).setZone(TZ_LOCAL).startOf("day")
  const dias = Math.round(fecha.diff(hoy, "days").days)

  const cuando =
    dias <= 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`
  const fechaTxt = capitalizar(fecha.setLocale("es").toFormat("ccc d LLL")).replace(".", "")
  const pronto = dias <= 7

  return (
    <li className={cn("flex items-center gap-3 py-2.5", borde && "border-t border-border/60")}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground"
        aria-hidden
      >
        <CakeIcon className="size-4" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{item.titulo}</span>
        <span className="truncate text-xs text-muted-foreground">
          {fechaTxt} ·{" "}
          <span className={cn(pronto && "font-medium text-foreground")}>{cuando}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => onBorrar(item)}
        aria-label={`Eliminar ${item.titulo}`}
        className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Trash2Icon className="size-4" />
      </button>
    </li>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

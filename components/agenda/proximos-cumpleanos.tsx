"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { CakeIcon, Trash2Icon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { AgendaItem, MiembroRef } from "@/lib/agenda/tipos"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { eliminarActividadRecurrente } from "@/app/(app)/tareas/actions"
import { useConfirmar } from "@/components/ui/confirm-dialog"
import { AgendaSheet } from "./agenda-sheet"
import { cn } from "@/lib/utils"

/**
 * "Cumpleaños y fechas anuales": la vista a FUTURO de las reglas recurrentes de
 * tipo anual. La lista principal de Tareas solo expande una ventana corta (~60d),
 * así que un cumpleaños lejano no se vería; acá se muestra la próxima ocurrencia de
 * cada regla anual (ventana de 366d), ordenada por proximidad. Tocar una fila la
 * edita (misma hoja que Tareas, con el patrón "Cada año"); el bote la elimina.
 */
export function ProximosCumpleanos({
  items,
  nowISO,
  miembros,
  categorias,
  agregadoPor,
}: {
  items: AgendaItem[]
  nowISO: string
  miembros: MiembroRef[]
  categorias: CategoriaRef[]
  agregadoPor: string | null
}) {
  const router = useRouter()
  const confirmar = useConfirmar()
  const [pendiente, startTransition] = useTransition()
  const [editando, setEditando] = useState<AgendaItem | null>(null)

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
            onEditar={setEditando}
            onBorrar={borrar}
          />
        ))}
      </ul>

      {editando && (
        <AgendaSheet
          miembros={miembros}
          categorias={categorias}
          agregadoPor={agregadoPor}
          editar={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </section>
  )
}

function FilaCumple({
  item,
  nowISO,
  borde,
  onEditar,
  onBorrar,
}: {
  item: AgendaItem
  nowISO: string
  borde: boolean
  onEditar: (i: AgendaItem) => void
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

      <button
        type="button"
        onClick={() => onEditar(item)}
        aria-label={`Editar ${item.titulo}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span className="truncate text-sm font-medium text-foreground">{item.titulo}</span>
        <span className="truncate text-xs text-muted-foreground">
          {fechaTxt} ·{" "}
          <span className={cn(pronto && "font-medium text-foreground")}>{cuando}</span>
        </span>
      </button>

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
